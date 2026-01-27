"""
Taxonomy Validation
===================

Validates training data against MIM taxonomy.

CRITICAL CHECKS:
- No invalid root causes
- No invalid subtypes
- Subtype matches root cause
- No generic collapse (algorithm_choice)
- Distribution checks
"""

import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import pandas as pd

from app.mim.taxonomy.root_causes import ROOT_CAUSES
from app.mim.taxonomy.subtype_masks import (
    SUBTYPES,
    ROOT_CAUSE_TO_SUBTYPES,
    is_valid_pair,
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# VALIDATION FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def validate_taxonomy_coverage(
    data_path: str,
    strict: bool = True,
) -> Dict[str, any]:
    """
    Validate dataset against MIM taxonomy.
    
    Parameters
    ----------
    data_path : str
        Path to mim_failure_transitions.parquet
    strict : bool
        If True, raise exceptions on failures
        
    Returns
    -------
    Dict
        Validation report
    """
    
    logger.info(f"Validating taxonomy for {data_path}")
    
    df = pd.read_parquet(data_path)
    
    report = {
        "total_samples": len(df),
        "valid": True,
        "errors": [],
        "warnings": [],
    }
    
    # ───────────────────────────────────────────────────────────────────────────
    # CHECK 1: Invalid root causes
    # ───────────────────────────────────────────────────────────────────────────
    invalid_root_causes = df[~df["root_cause"].isin(ROOT_CAUSES)]
    
    if len(invalid_root_causes) > 0:
        invalid_values = invalid_root_causes["root_cause"].unique().tolist()
        error = f"Invalid root_causes found: {invalid_values} ({len(invalid_root_causes)} samples)"
        report["errors"].append(error)
        report["valid"] = False
        logger.error(error)
    
    # ───────────────────────────────────────────────────────────────────────────
    # CHECK 2: Invalid subtypes
    # ───────────────────────────────────────────────────────────────────────────
    invalid_subtypes = df[~df["subtype"].isin(SUBTYPES)]
    
    if len(invalid_subtypes) > 0:
        invalid_values = invalid_subtypes["subtype"].unique().tolist()
        error = f"Invalid subtypes found: {invalid_values} ({len(invalid_subtypes)} samples)"
        report["errors"].append(error)
        report["valid"] = False
        logger.error(error)
    
    # ───────────────────────────────────────────────────────────────────────────
    # CHECK 3: Subtype-root cause mismatch
    # ───────────────────────────────────────────────────────────────────────────
    # USE is_valid_pair() which supports subtypes belonging to MULTIPLE roots
    def check_subtype_match(row):
        return is_valid_pair(row["root_cause"], row["subtype"])
    
    df["_subtype_match"] = df.apply(check_subtype_match, axis=1)
    mismatched = df[~df["_subtype_match"]]
    
    if len(mismatched) > 0:
        sample_mismatches = mismatched[["root_cause", "subtype"]].drop_duplicates().head(5)
        error = f"Subtype-root_cause mismatches: {len(mismatched)} samples. Examples: {sample_mismatches.to_dict('records')}"
        report["errors"].append(error)
        report["valid"] = False
        logger.error(error)
    
    df.drop(columns=["_subtype_match"], inplace=True)
    
    # ───────────────────────────────────────────────────────────────────────────
    # CHECK 4: Generic collapse detection
    # ───────────────────────────────────────────────────────────────────────────
    # Check if any single category dominates > 50%
    root_cause_dist = df["root_cause"].value_counts(normalize=True)
    
    for rc, pct in root_cause_dist.items():
        if pct > 0.5:
            warning = f"Potential collapse: root_cause='{rc}' represents {pct*100:.1f}% of data"
            report["warnings"].append(warning)
            logger.warning(warning)
    
    # Check subtype distribution within each root cause
    for rc in ROOT_CAUSES:
        rc_df = df[df["root_cause"] == rc]
        if len(rc_df) > 10:
            subtype_dist = rc_df["subtype"].value_counts(normalize=True)
            top_subtype = subtype_dist.index[0]
            top_pct = subtype_dist.iloc[0]
            
            if top_pct > 0.7:
                warning = f"Potential subtype collapse for {rc}: '{top_subtype}' = {top_pct*100:.1f}%"
                report["warnings"].append(warning)
                logger.warning(warning)
    
    # ───────────────────────────────────────────────────────────────────────────
    # CHECK 5: Cold start handling
    # ───────────────────────────────────────────────────────────────────────────
    if "is_cold_start" in df.columns:
        cold_start_pct = df["is_cold_start"].mean()
        report["cold_start_percentage"] = cold_start_pct * 100
        
        if cold_start_pct > 0.5:
            warning = f"High cold start rate: {cold_start_pct*100:.1f}%"
            report["warnings"].append(warning)
            logger.warning(warning)
    
    # ───────────────────────────────────────────────────────────────────────────
    # CHECK 6: Split balance
    # ───────────────────────────────────────────────────────────────────────────
    if "split" in df.columns:
        split_dist = df["split"].value_counts()
        report["split_distribution"] = split_dist.to_dict()
        logger.info(f"Split distribution: {split_dist.to_dict()}")
    
    # ───────────────────────────────────────────────────────────────────────────
    # SUMMARY
    # ───────────────────────────────────────────────────────────────────────────
    report["root_cause_distribution"] = df["root_cause"].value_counts().to_dict()
    report["subtype_distribution"] = df["subtype"].value_counts().to_dict()
    report["category_distribution"] = df["category"].value_counts().head(10).to_dict()
    
    if report["valid"]:
        logger.info("✅ Taxonomy validation PASSED")
    else:
        logger.error("❌ Taxonomy validation FAILED")
        if strict:
            raise ValueError(f"Taxonomy validation failed: {report['errors']}")
    
    return report


def validate_sample(
    root_cause: str,
    subtype: str,
    strict: bool = True,
) -> bool:
    """
    Validate a single root_cause + subtype pair.
    
    Returns True if valid, raises ValueError if strict=True and invalid.
    """
    
    # Check root cause
    if root_cause not in ROOT_CAUSES:
        if strict:
            raise ValueError(f"Invalid root_cause: '{root_cause}'. Must be one of {ROOT_CAUSES}")
        return False
    
    # Check subtype
    if subtype not in SUBTYPES:
        if strict:
            raise ValueError(f"Invalid subtype: '{subtype}'. Must be one of {SUBTYPES}")
        return False
    
    # Check match using is_valid_pair (supports subtypes with MULTIPLE valid roots)
    if not is_valid_pair(root_cause, subtype):
        if strict:
            valid_subtypes = ROOT_CAUSE_TO_SUBTYPES.get(root_cause, frozenset())
            raise ValueError(
                f"Subtype '{subtype}' is not valid for root_cause '{root_cause}'. "
                f"Valid subtypes: {sorted(valid_subtypes)}"
            )
        return False
    
    return True


def get_taxonomy_stats() -> Dict:
    """Get statistics about the taxonomy."""
    
    return {
        "num_root_causes": len(ROOT_CAUSES),
        "root_causes": sorted(ROOT_CAUSES),
        "num_subtypes": len(SUBTYPES),
        "subtypes_by_root_cause": {
            rc: sorted(subtypes) 
            for rc, subtypes in ROOT_CAUSE_TO_SUBTYPES.items()
        },
    }
