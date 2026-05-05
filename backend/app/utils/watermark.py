import io
from PIL import Image, ImageDraw, ImageFont
import logging

logger = logging.getLogger(__name__)

def apply_watermark(file_content: bytes, watermark_text: str = "DOCUMENT POUR LOCATION ROOMIVO") -> bytes:
    """
    Apply a visible watermark to an image to prevent misuse.
    Currently supports JPEG, PNG, WEBP.
    Returns the watermarked image as bytes.
    """
    try:
        # Load the image
        img = Image.open(io.BytesIO(file_content))
        
        # Convert to RGB if necessary (to avoid issues with PNG transparency or CMYK)
        if img.mode != "RGB":
            img = img.convert("RGB")
            
        # Create an overlay for the watermark
        overlay = Image.new("RGBA", img.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(overlay)
        
        # Calculate font size based on image width
        width, height = img.size
        font_size = int(width / 20)
        if font_size < 12: font_size = 12
        
        # Try to use a default font
        try:
            # On many systems, DejaVuSans or Arial might be available.
            # Fallback to default if not.
            font = ImageFont.load_default()
        except Exception:
            font = ImageFont.load_default()
            
        # Define color with transparency (Semi-transparent white/gray)
        watermark_color = (128, 128, 128, 128)
        
        # Draw watermark multiple times across the image (tiled)
        # This makes it harder to crop out
        step_x = int(width / 3)
        step_y = int(height / 4)
        
        for x in range(0, width, step_x):
            for y in range(0, height, step_y):
                draw.text((x + 10, y + 10), watermark_text, font=font, fill=watermark_color)
        
        # Composite the overlay onto the original image
        watermarked = Image.alpha_composite(img.convert("RGBA"), overlay)
        
        # Save back to bytes
        output = io.BytesIO()
        watermarked.convert("RGB").save(output, format="JPEG", quality=85)
        return output.getvalue()
        
    except Exception as e:
        logger.error(f"Failed to apply watermark: {e}")
        # If watermarking fails, return original content rather than crashing, 
        # but log the failure. 
        return file_content
