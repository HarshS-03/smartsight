import os
import sys
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'smartsight.settings')
django.setup()

from app.models import Person, PersonImage, PersonEmbedding
from app.utils.embedding_engine import compute_embedding, get_gallery

print("=" * 60)
print("SmartSight — Bulk ArcFace Embedding Generator")
print("=" * 60)

persons = Person.objects.all().order_by('name')
total_computed = 0
total_skipped = 0
total_errors = 0

for p_idx, person in enumerate(persons, 1):
    images = PersonImage.objects.filter(person=person)
    if not images.exists():
        print(f"[{p_idx}/{len(persons)}] {person.name}: No images — skipping")
        continue

    computed = 0
    skipped = 0
    errors = 0

    print(f"[{p_idx}/{len(persons)}] Processing {person.name} ({images.count()} images)...", flush=True)

    for pi in images:
        # Skip if embedding already exists
        if PersonEmbedding.objects.filter(person=person, source_image=pi).exists():
            skipped += 1
            continue

        try:
            result = compute_embedding(pi.image.path)
            if result is not None:
                emb, det_conf, _ = result
                PersonEmbedding.objects.create(
                    person=person,
                    source_image=pi,
                    embedding=emb.tolist(),
                )
                computed += 1
                print(f"  + Generated embedding for {os.path.basename(pi.image.name)} (conf: {det_conf:.2f})", flush=True)
            else:
                errors += 1
                print(f"  x No face detected in {os.path.basename(pi.image.name)}", flush=True)
        except Exception as e:
            errors += 1
            print(f"  ! Error on {os.path.basename(pi.image.name)}: {e}", flush=True)

    total_computed += computed
    total_skipped += skipped
    total_errors += errors
    print(f" -> {person.name}: {computed} new, {skipped} already existed, {errors} errors\n", flush=True)

# Reload gallery with all new embeddings
gallery = get_gallery()
gallery.reload()
stats = gallery.stats()

print()
print("=" * 60)
print(f"DONE — {total_computed} embeddings computed, {total_skipped} skipped, {total_errors} errors")
print(f"Gallery: {stats['total_persons']} persons, {stats['total_embeddings']} embeddings loaded")
print("=" * 60)
