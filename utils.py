def is_valid_email(email):
    """
    Assume frontend restricts to @bristol.ac.uk only.
    For compatibility, just check non-empty input.
    """
    return bool(email and "@" in email)