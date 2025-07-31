import re

def is_valid_email(email):
    """
    严格限定 bristol.ac.uk 邮箱，防止冒用。
    """
    if not email or not isinstance(email, str):
        return False
    email = email.strip().lower()
    # 校验格式和后缀
    if re.match(r"^[a-z0-9._%+-]+@bristol\.ac\.uk$", email):
        return True
    return False