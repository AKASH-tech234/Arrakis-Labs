#!/usr/bin/env python3
"""
Build a sampled Codeforces dataset from the local Hugging Face cache.

- Uses locally downloaded open-r1/codeforces-submissions
- Reads Parquet shards lazily (no full RAM load)
- Computes exact verdict distribution
- Produces a statistically correct 500K sample
- Outputs: data/codeforces_500k.parquet

Requirements:
  pip install polars pyarrow datasets
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from datetime import datetime
import logging

import polars as pl


# ──────────────────────────────────────────────────────────────────────────────
# Logging
# ──────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("codeforces-sampler")


# ──────────────────────────────────────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

HF_HOME = Path(os.environ.get("HF_HOME", Path.home() / ".cache" / "huggingface" / "hub"))
DATASET_ROOT = HF_HOME / "datasets--open-r1--codeforces-submissions" / "snapshots"


def find_latest_snapshot() -> Path:
    if not DATASET_ROOT.exists():
        raise RuntimeError(
            "Hugging Face dataset cache not found.\n"
            "Download first using:\n"
            "  hf download open-r1/codeforces-submissions"
        )

    snapshots = [p for p in DATASET_ROOT.iterdir() if p.is_dir()]
    if not snapshots:
        raise RuntimeError("No dataset snapshots found.")

    # Hugging Face snapshots are immutable; latest is sufficient
    snapshot = sorted(snapshots)[-1]
    data_path = snapshot / "data"

    if not data_path.exists():
        raise RuntimeError(f"Snapshot found but no data directory: {snapshot}")

    logger.info(f"Using dataset snapshot: {snapshot.name}")
    return data_path


# ──────────────────────────────────────────────────────────────────────────────
# Core Logic
# ──────────────────────────────────────────────────────────────────────────────

def load_lazy_dataset() -> pl.LazyFrame:
    data_path = find_latest_snapshot()
    parquet_glob = str(data_path / "train-*.parquet")

    logger.info("Opening Parquet shards lazily (no RAM materialization)...")
    return pl.scan_parquet(parquet_glob)


def compute_verdict_distribution(df: pl.LazyFrame) -> pl.DataFrame:
    logger.info("Computing exact verdict distribution...")
    dist = (
        df.group_by("verdict")
          .len()
          .sort("len", descending=True)
          .collect()
    )

    total = dist["len"].sum()
    dist = dist.with_columns(
        (pl.col("len") / total * 100).alias("percentage")
    )

    logger.info("Verdict distribution:")
    for row in dist.iter_rows(named=True):
        logger.info(
            f"  {row['verdict']}: {row['len']:,} ({row['percentage']:.2f}%)"
        )

    logger.info(f"Total submissions: {total:,}")
    return dist


def proportional_sample(
    df: pl.LazyFrame,
    verdict_dist: pl.DataFrame,
    sample_size: int,
    seed: int = 42,
) -> pl.DataFrame:
    logger.info(f"Building proportional sample of {sample_size:,} rows...")

    total_rows = verdict_dist["len"].sum()

    samples = []

    for row in verdict_dist.iter_rows(named=True):
        verdict = row["verdict"]
        count = row["len"]

        target = int(round(sample_size * (count / total_rows)))
        if target <= 0:
            continue

        # Skip None verdicts (null values)
        if verdict is None:
            logger.info(f"  Skipping {count:,} rows with verdict=None")
            continue

        # Ensure we don't sample more than available
        actual_sample = min(target, count)
        
        logger.info(f"  Sampling {actual_sample:,} rows for verdict={verdict}")

        subset = (
            df.filter(pl.col("verdict") == verdict)
              .select([
                  "submission_id",
                  "problem_id",
                  "contestId",
                  "verdict",
                  "programmingLanguage",
                  "source",
                  "timeConsumedMillis",
                  "memoryConsumedBytes",
              ])
              .collect()
              .sample(n=actual_sample, seed=seed, with_replacement=False)
        )

        samples.append(subset)

    logger.info("Concatenating sampled partitions...")
    result = pl.concat(samples)

    logger.info("Shuffling final dataset...")
    result = result.sample(n=len(result), seed=seed, shuffle=True)

    return result


# ──────────────────────────────────────────────────────────────────────────────
# Output
# ──────────────────────────────────────────────────────────────────────────────

def save_dataset(df: pl.DataFrame, output_path: Path) -> None:
    logger.info(f"Saving dataset to {output_path}")
    df = df.rename({
        "contestId": "contest_id",
        "programmingLanguage": "language",
        "source": "code",
        "timeConsumedMillis": "time_consumed_ms",
        "memoryConsumedBytes": "memory_consumed_bytes",
    })

    if "code" in df.columns:
        df = df.with_columns(pl.col("code").cast(pl.Utf8).str.slice(0, 10_000))

    df.write_parquet(output_path)

    size_mb = output_path.stat().st_size / (1024 * 1024)
    logger.info(f"Saved {len(df):,} rows ({size_mb:.1f} MB)")


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    logger.info("=" * 70)
    logger.info("Codeforces Dataset Sampler")
    logger.info(f"Started at: {datetime.now().isoformat()}")
    logger.info("=" * 70)

    SAMPLE_SIZE = 500_000
    OUTPUT_PATH = DATA_DIR / "codeforces_500k.parquet"

    if OUTPUT_PATH.exists():
        logger.info(f"Output already exists: {OUTPUT_PATH}")
        logger.info("Delete it to rebuild.")
        return

    df = load_lazy_dataset()
    verdict_dist = compute_verdict_distribution(df)
    sample_df = proportional_sample(df, verdict_dist, SAMPLE_SIZE)
    save_dataset(sample_df, OUTPUT_PATH)

    logger.info("=" * 70)
    logger.info("Done.")
    logger.info("=" * 70)


if __name__ == "__main__":
    main()
