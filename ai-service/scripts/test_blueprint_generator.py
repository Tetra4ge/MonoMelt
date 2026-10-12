"""
Offline test for the blueprint generator (no services needed).

    cd ai-service && .venv/bin/python scripts/test_blueprint_generator.py
"""
import base64
import hashlib
import io
import os
import sys
import uuid
import zipfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models.blueprints import GenerateBlueprintRequest
from services.blueprint_generator import DNS_LABEL_RE, BlueprintGenerator


def request(names, provider="aws"):
    return GenerateBlueprintRequest(
        project_id=uuid.uuid4(), scenario_revision_id=uuid.uuid4(), plan_revision_id=uuid.uuid4(),
        proposed_services=[{"name": n} for n in names],
        assumptions={"cloud_provider": provider, "pricing_region": "eu-west-1"},
    )


def main():
    names = ["Service_1", "../../evil", "Service 1", "Billing Service", ""]
    res = BlueprintGenerator(request(names)).generate()

    archive = zipfile.ZipFile(io.BytesIO(base64.b64decode(res.blueprint_zip_base64)))
    zip_names = archive.namelist()
    assert all(n.startswith("blueprint/") and ".." not in n.split("/") for n in zip_names), zip_names

    service_dirs = sorted({n.split("/")[2] for n in zip_names if n.startswith("blueprint/services/")})
    assert len(service_dirs) == len(names), service_dirs                 # duplicates were de-duplicated, none dropped
    assert all(DNS_LABEL_RE.match(d) for d in service_dirs), service_dirs
    assert "service-1" in service_dirs and "service-1-2" in service_dirs, service_dirs

    # preview map matches the archive, and the manifest hashes match the content
    assert set(res.files) == set(zip_names) - {"blueprint/manifest.json"}, set(res.files) ^ set(zip_names)
    for art in res.manifest.artifacts:
        assert hashlib.sha256(res.files[art.path].encode()).hexdigest() == art.sha256

    assert all(res.manifest.validation_results.values()), res.manifest.validation_results

    tf = res.files["blueprint/infrastructure/terraform/main.tf"]
    assert 'aws_ecr_repository' in tf and '"billing-service"' in tf and 'eu-west-1' in tf
    for provider, marker in (("azure", "azurerm_container_registry"), ("gcp", "google_artifact_registry_repository")):
        out = BlueprintGenerator(request(["a"], provider)).generate()
        assert marker in out.files["blueprint/infrastructure/terraform/main.tf"], provider

    # a leaked credential must flip the credential check
    gen = BlueprintGenerator(request(["a"]))
    gen.files["x"] = "key=AKIAABCDEFGHIJKLMNOP"
    assert not gen._validate({"paths": {"/api/v1/a": {}}}, [{"name": "a"}])["no_credentials_detected"]

    try:
        BlueprintGenerator(request([])).generate()
        raise AssertionError("empty service list must be rejected")
    except ValueError:
        pass

    print("blueprint generator: all assertions passed")


main()
