from pydantic import BaseModel


class CompressedHint(BaseModel):
    hint: str
