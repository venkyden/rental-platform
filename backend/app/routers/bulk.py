"""
Bulk Import/Export API for managing hundreds of property listings.
Supports CSV and XML formats for S3 Enterprise users.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime
import csv
import io
import xml.etree.ElementTree as ET
from uuid import UUID

from app.core.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User, UserRole
from app.models.property import Property

router = APIRouter(prefix="/bulk", tags=["Bulk Import/Export"])


# CSV column mapping
CSV_HEADERS = [
    "title", "description", "property_type", "address_line1", "address_line2",
    "city", "postal_code", "country", "price", "surface_area", "rooms",
    "bedrooms", "bathrooms", "floor", "has_elevator", "has_parking",
    "has_balcony", "has_garden", "energy_class", "ges_class", "status"
]


@router.get("/properties/template")
async def get_import_template(
    format: str = Query("csv", pattern="^(csv|xml)$"),
    current_user: User = Depends(get_current_user)
):
    """
    Download import template with headers and example data.
    """
    if current_user.role not in [UserRole.LANDLORD, UserRole.PROPERTY_MANAGER]:
        raise HTTPException(status_code=403, detail="Only landlords can access bulk operations")
    
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Headers
        writer.writerow(CSV_HEADERS)
        
        # Example row
        writer.writerow([
            "Appartement 3 pièces Paris 11",  # title
            "Bel appartement lumineux...",     # description
            "apartment",                        # property_type
            "123 Rue de la République",        # address_line1
            "Bâtiment A",                      # address_line2
            "Paris",                           # city
            "75011",                           # postal_code
            "France",                          # country
            "1500",                            # price
            "65",                              # surface_area
            "3",                               # rooms
            "2",                               # bedrooms
            "1",                               # bathrooms
            "3",                               # floor
            "true",                            # has_elevator
            "false",                           # has_parking
            "true",                            # has_balcony
            "false",                           # has_garden
            "C",                               # energy_class
            "D",                               # ges_class
            "draft"                            # status
        ])
        
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=properties_template.csv"}
        )
    
    else:  # XML
        root = ET.Element("properties")
        example = ET.SubElement(root, "property")
        
        for header in CSV_HEADERS:
            elem = ET.SubElement(example, header)
            if header == "title":
                elem.text = "Appartement 3 pièces Paris 11"
            elif header == "property_type":
                elem.text = "apartment"
            elif header == "city":
                elem.text = "Paris"
            elif header == "price":
                elem.text = "1500"
            elif header == "status":
                elem.text = "draft"
            else:
                elem.text = ""
        
        output = io.BytesIO()
        tree = ET.ElementTree(root)
        tree.write(output, encoding="utf-8", xml_declaration=True)
        output.seek(0)
        
        return StreamingResponse(
            output,
            media_type="application/xml",
            headers={"Content-Disposition": "attachment; filename=properties_template.xml"}
        )


@router.get("/properties/export")
async def export_properties(
    format: str = Query("csv", pattern="^(csv|xml)$"),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Export all properties as CSV or XML.
    """
    if current_user.role not in [UserRole.LANDLORD, UserRole.PROPERTY_MANAGER]:
        raise HTTPException(status_code=403, detail="Only landlords can export")
    
    # Get properties
    query = select(Property).where(Property.landlord_id == current_user.id)
    if status:
        query = query.where(Property.status == status)
    
    result = await db.execute(query)
    properties = result.scalars().all()
    
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id"] + CSV_HEADERS)
        
        for prop in properties:
            writer.writerow([
                str(prop.id),
                prop.title,
                prop.description,
                prop.property_type,
                prop.address_line1,
                prop.address_line2 or "",
                prop.city,
                prop.postal_code,
                prop.country,
                prop.price,
                prop.surface_area,
                prop.rooms,
                prop.bedrooms,
                prop.bathrooms,
                prop.floor or "",
                str(prop.has_elevator).lower() if prop.has_elevator is not None else "",
                str(prop.has_parking).lower() if prop.has_parking is not None else "",
                str(prop.has_balcony).lower() if prop.has_balcony is not None else "",
                str(prop.has_garden).lower() if prop.has_garden is not None else "",
                prop.energy_class or "",
                prop.ges_class or "",
                prop.status
            ])
        
        output.seek(0)
        filename = f"properties_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    
    else:  # XML
        root = ET.Element("properties")
        root.set("exported_at", datetime.now().isoformat())
        root.set("count", str(len(properties)))
        
        for prop in properties:
            elem = ET.SubElement(root, "property")
            elem.set("id", str(prop.id))
            
            for header in CSV_HEADERS:
                child = ET.SubElement(elem, header)
                value = getattr(prop, header, None)
                if value is not None:
                    if isinstance(value, bool):
                        child.text = str(value).lower()
                    else:
                        child.text = str(value)
        
        output = io.BytesIO()
        tree = ET.ElementTree(root)
        tree.write(output, encoding="utf-8", xml_declaration=True)
        output.seek(0)
        
        filename = f"properties_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xml"
        
        return StreamingResponse(
            output,
            media_type="application/xml",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )


@router.post("/properties/import")
async def import_properties(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Import properties from CSV or XML file.
    Returns summary of imported, updated, and failed rows.
    """
    if current_user.role not in [UserRole.LANDLORD, UserRole.PROPERTY_MANAGER]:
        raise HTTPException(status_code=403, detail="Only landlords can import")
    
    content = await file.read()
    
    # Detect format
    is_xml = file.filename.lower().endswith('.xml') or file.content_type == 'application/xml'
    
    results = {
        "created": 0,
        "updated": 0,
        "failed": 0,
        "errors": []
    }
    
    if is_xml:
        try:
            root = ET.fromstring(content)
            rows = []
            for prop_elem in root.findall('.//property'):
                row = {}
                for child in prop_elem:
                    row[child.tag] = child.text or ""
                row['id'] = prop_elem.get('id')
                rows.append(row)
        except ET.ParseError as e:
            raise HTTPException(status_code=400, detail=f"Invalid XML: {e}")
    else:
        try:
            content_str = content.decode('utf-8')
            reader = csv.DictReader(io.StringIO(content_str))
            rows = list(reader)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid CSV: {e}")
    
    for idx, row in enumerate(rows, start=1):
        try:
            # Check for update vs create
            existing = None
            if row.get('id'):
                result = await db.execute(
                    select(Property).where(Property.id == row['id'])
                )
                existing = result.scalar_one_or_none()
            
            # Parse boolean fields
            def parse_bool(val):
                if val is None or val == "":
                    return None
                return val.lower() in ('true', '1', 'yes', 'oui')
            
            # Parse numeric fields
            def parse_num(val, default=None):
                if val is None or val == "":
                    return default
                try:
                    return float(val) if '.' in str(val) else int(val)
                except:
                    return default
            
            if existing:
                # Update existing
                existing.title = row.get('title') or existing.title
                existing.description = row.get('description') or existing.description
                existing.property_type = row.get('property_type') or existing.property_type
                existing.address_line1 = row.get('address_line1') or existing.address_line1
                existing.address_line2 = row.get('address_line2') or existing.address_line2
                existing.city = row.get('city') or existing.city
                existing.postal_code = row.get('postal_code') or existing.postal_code
                existing.price = parse_num(row.get('price'), existing.price)
                existing.surface_area = parse_num(row.get('surface_area'), existing.surface_area)
                existing.status = row.get('status') or existing.status
                results["updated"] += 1
            else:
                # Create new
                prop = Property(
                    landlord_id=current_user.id,
                    title=row.get('title', 'Untitled'),
                    description=row.get('description', ''),
                    property_type=row.get('property_type', 'apartment'),
                    address_line1=row.get('address_line1', ''),
                    address_line2=row.get('address_line2'),
                    city=row.get('city', ''),
                    postal_code=row.get('postal_code', ''),
                    country=row.get('country', 'France'),
                    price=parse_num(row.get('price'), 0),
                    surface_area=parse_num(row.get('surface_area'), 0),
                    rooms=parse_num(row.get('rooms'), 1),
                    bedrooms=parse_num(row.get('bedrooms'), 1),
                    bathrooms=parse_num(row.get('bathrooms'), 1),
                    floor=parse_num(row.get('floor')),
                    has_elevator=parse_bool(row.get('has_elevator')),
                    has_parking=parse_bool(row.get('has_parking')),
                    has_balcony=parse_bool(row.get('has_balcony')),
                    has_garden=parse_bool(row.get('has_garden')),
                    energy_class=row.get('energy_class'),
                    ges_class=row.get('ges_class'),
                    status=row.get('status', 'draft')
                )
                db.add(prop)
                results["created"] += 1
                
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"Row {idx}: {str(e)}")
    
    await db.commit()
    
    return {
        "status": "completed",
        "total_rows": len(rows),
        "created": results["created"],
        "updated": results["updated"],
        "failed": results["failed"],
        "errors": results["errors"][:10]  # Limit error messages
    }


@router.get("/properties/preview")
async def preview_import(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Preview import file without actually importing.
    Returns parsed rows for validation.
    """
    if current_user.role not in [UserRole.LANDLORD, UserRole.PROPERTY_MANAGER]:
        raise HTTPException(status_code=403, detail="Only landlords can import")
    
    content = await file.read()
    is_xml = file.filename.lower().endswith('.xml') or file.content_type == 'application/xml'
    
    rows = []
    
    if is_xml:
        try:
            root = ET.fromstring(content)
            for prop_elem in root.findall('.//property'):
                row = {"id": prop_elem.get('id')}
                for child in prop_elem:
                    row[child.tag] = child.text or ""
                rows.append(row)
        except ET.ParseError as e:
            raise HTTPException(status_code=400, detail=f"Invalid XML: {e}")
    else:
        try:
            content_str = content.decode('utf-8')
            reader = csv.DictReader(io.StringIO(content_str))
            rows = list(reader)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid CSV: {e}")
    
    return {
        "row_count": len(rows),
        "columns": list(rows[0].keys()) if rows else [],
        "preview": rows[:5],  # First 5 rows
        "valid": True
    }
