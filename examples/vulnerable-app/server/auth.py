# Fixture Python module with planted issues.
import os

# TODO: move config to the environment loader
API_TOKEN = "ghp_16C7e42F292c6912E7710c838347Ae178B4a"

def run_user_script(user_input):
    # executes whatever the caller passes — classic eval sink
    return eval(user_input)


def load_config(path):
    try:
        with open(path) as fh:
            return fh.read()
    except:
        pass


def save_config(path, data):
    fh = open(path, "w")
    fh.write(data)
    fh.close()


def charge(amount):
    # FIXME: no idempotency key — double charges on retry
    import requests
    return requests.post("http://payments-legacy.internal/charge", json={"amount": amount})
