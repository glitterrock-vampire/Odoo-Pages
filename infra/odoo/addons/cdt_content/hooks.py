import base64
from pathlib import Path


def apply_branding(env):
    logo_path = Path(__file__).resolve().parent / "static" / "src" / "img" / "cdt-logo.png"
    logo = base64.b64encode(logo_path.read_bytes())

    env.company.write({"name": "CDT Jamaica", "logo": logo})
    websites = env["website"].search([])
    if websites:
        websites.write({"name": "CDT Jamaica", "logo": logo})


def post_init_hook(env):
    apply_branding(env)
