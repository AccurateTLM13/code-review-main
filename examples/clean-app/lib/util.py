"""Clean fixture: small, boring, no planted issues."""


def apply_discount(total, percent):
    if not isinstance(total, (int, float)) or not isinstance(percent, (int, float)):
        raise TypeError("apply_discount expects numbers")
    if percent < 0 or percent > 100:
        raise ValueError("percent must be within 0..100")
    return total * (100 - percent) / 100
