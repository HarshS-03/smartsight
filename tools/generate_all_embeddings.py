import os
import django
import sys
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'smartsight.settings')
django.setup()

from django.conf import settings
from app.models import Person, PersonImage
from app.utils.embedding_engine import compute_person_embeddings, get_gallery

def run():
    print("Starting full database embedding generation...")
    # Temporarily disable Supabase Sync so we don't spam the cloud DB every second
    original_sync = getattr(settings, 'SUPABASE_SYNC_ENABLED', True)
    settings.SUPABASE_SYNC_ENABLED = False
    
    persons = Person.objects.all()
    total = persons.count()
    
    total_computed = 0
    total_errors = 0
    
    # Clear the whole gallery first
    gallery = get_gallery()
    gallery._gallery.clear()
    
    for i, person in enumerate(persons, 1):
        print(f"[{i}/{total}] Processing {person.name}...")
        computed, skipped, errors = compute_person_embeddings(person.id)
        total_computed += computed
        total_errors += errors
        time.sleep(0.1) # Small delay
        
    # Re-enable sync and do one massive upload at the end
    settings.SUPABASE_SYNC_ENABLED = original_sync
    print("Saving and uploading final .npz to Supabase...")
    gallery._save_cache()
    
    print("\n--- Summary ---")
    print(f"Total New Embeddings Computed: {total_computed}")
    print(f"Total Errors/No Face Detected: {total_errors}")
    print("Generation complete! The .npz cache has been automatically saved.")
    
    if original_sync:
        print("Waiting 5 seconds for final cloud upload to finish...")
        time.sleep(5)

if __name__ == '__main__':
    run()
