#!/usr/bin/env python3
"""Install official Android tooling in a writable directory, checking its published hash."""
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import urllib.request
import zipfile

SDK = Path(os.environ.get("ANDROID_HOME", "/workspace/tools/android-sdk")).resolve()
ARCHIVE_NAME = "commandlinetools-linux-16111833_latest.zip"
# Google's official repository2-3.xml publishes SHA-1 and byte length for this artifact.
PUBLISHED_SHA1 = "e025545c62a8e64c7559119566a569fb1dec5f60"
PUBLISHED_SIZE = 181052239
URL = "https://dl.google.com/android/repository/" + ARCHIVE_NAME

if sys.platform != "linux":
    raise SystemExit("Este auxiliar atende Linux. Em Windows/macOS, instale o Android SDK oficial pelo Android Studio.")
SDK.mkdir(parents=True, exist_ok=True)
manager = SDK / "cmdline-tools/latest/bin/sdkmanager"
if not manager.exists():
    archive = SDK / ARCHIVE_NAME
    if not archive.exists():
        with urllib.request.urlopen(URL, timeout=60) as response, archive.open("wb") as out:
            while block := response.read(1024 * 1024):
                out.write(block)
    digest = hashlib.sha1(archive.read_bytes()).hexdigest()
    if archive.stat().st_size != PUBLISHED_SIZE or digest != PUBLISHED_SHA1:
        archive.unlink(missing_ok=True)
        raise SystemExit("Falha de integridade do SDK; nenhum arquivo foi instalado.")
    destination = SDK / "cmdline-tools/latest"
    with zipfile.ZipFile(archive) as zipped:
        for entry in zipped.infolist():
            relative = Path(entry.filename).relative_to("cmdline-tools")
            target = (destination / relative).resolve()
            if not target.is_relative_to(destination.resolve()):
                raise SystemExit("Caminho inválido no SDK.")
            if entry.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(zipped.read(entry))
            if relative.parts[0] == "bin":
                target.chmod(0o755)
    print("Command-line tools oficial: tamanho e SHA-1 publicados conferidos.")

env = dict(os.environ)
env["ANDROID_HOME"] = str(SDK)
env["ANDROID_USER_HOME"] = str(SDK.parent / "android-user")
env["JAVA_HOME"] = env.get("JAVA_HOME", "/usr/lib/jvm/java-21-openjdk-amd64")
env["JAVA_TOOL_OPTIONS"] = env.get("JAVA_TOOL_OPTIONS", "") + " -Djava.util.prefs.userRoot=" + str(SDK.parent / "java-preferences")
Path(env["ANDROID_USER_HOME"]).mkdir(parents=True, exist_ok=True)
# Google SDK licenses are displayed by the official tool and accepted for this build.
subprocess.run([str(manager), "--sdk_root=" + str(SDK), "--licenses"],
               input="y\n" * 100, text=True, env=env, check=True)
subprocess.run([str(manager), "--sdk_root=" + str(SDK), "platform-tools",
                "platforms;android-36", "build-tools;36.0.0"], env=env, check=True)
print("SDK pronto em", SDK)
