from cryptography.fernet import Fernet
from app.core.config import settings

# Initialize Fernet with the key from settings
# We use a lazy initialization or a function to ensure settings are loaded
_fernet: Fernet = None

def get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        _fernet = Fernet(settings.MESSAGE_ENCRYPTION_KEY.encode())
    return _fernet

def encrypt_content(content: str) -> str:
    """
    Encrypt string content and return base64 encoded ciphertext.
    """
    if not content:
        return content
    
    fernet = get_fernet()
    encrypted_bytes = fernet.encrypt(content.encode())
    return encrypted_bytes.decode()

def decrypt_content(ciphertext: str) -> str:
    """
    Decrypt base64 encoded ciphertext and return the original string.
    If decryption fails (e.g. content was not encrypted), return original content.
    """
    if not ciphertext:
        return ciphertext
    
    fernet = get_fernet()
    try:
        decrypted_bytes = fernet.decrypt(ciphertext.encode())
        return decrypted_bytes.decode()
    except Exception:
        # Fallback for unencrypted legacy messages
        return ciphertext
