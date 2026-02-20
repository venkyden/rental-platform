"""
HTML Templates for Lease Generation.
Based on French Legal Standards (Loi du 6 juillet 1989) and Custom Templates.
"""

LEASE_MEUBLE_HTML = """
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Contrat de Location Meublée</title>
    <style>
        body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.4; color: #000; max-width: 210mm; margin: 0 auto; padding: 20px; }
        h1 { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; }
        h2 { text-align: center; font-size: 11pt; font-weight: normal; margin-top: 0; font-style: italic; }
        h3 { font-size: 11pt; font-weight: bold; margin-top: 15px; text-transform: uppercase; background-color: #eee; padding: 5px; }
        h4 { font-size: 10pt; font-weight: bold; margin-top: 10px; margin-bottom: 5px; }
        .section { margin-bottom: 15px; }
        .value { font-weight: bold; }
        ul { margin-top: 5px; padding-left: 20px; }
        li { margin-bottom: 2px; }
        .page-break { page-break-before: always; }
        .signatures { margin-top: 30px; display: flex; justify-content: space-between; }
        .sig-box { width: 45%; border-top: 1px solid #000; padding-top: 10px; }
        .small { font-size: 9pt; font-style: italic; }
        @media print { body { padding: 0; margin: 15mm; } }
    </style>
</head>
<body>
    <h1>CONTRAT DE LOCATION DE LOGEMENT MEUBLÉ</h1>
    <h2>(Titre Ier bis de la loi n° 89-462 du 6 juillet 1989)</h2>

    <div class="section">
        <h3>I. DÉSIGNATION DES PARTIES</h3>
        <p><strong>LE BAILLEUR :</strong> {{ landlord_name }}<br>Adresse : {{ landlord_address }}<br>Email : {{ landlord_email }}</p>
        <p><strong>LE PRENEUR :</strong> {{ tenant_name }}<br>Adresse : {{ tenant_address }}</p>
    </div>

    <div class="section">
        <h3>II. OBJET DU CONTRAT</h3>
        <p><strong>Adresse :</strong> {{ property_address }}</p>
        <p><strong>Type :</strong> {{ property_description }}</p>
        <p><strong>Surface :</strong> {{ property_size }} m² - <strong>Pièces :</strong> {{ property_rooms }}</p>
    </div>

    <div class="section">
        <h3>III. DURÉE</h3>
        <p>Prise d'effet : <strong>{{ start_date }}</strong> pour une durée de <strong>{{ duration_text }}</strong>.</p>
        <p class="small">Reconduction tacite par période d'un an (sauf étudiant 9 mois).</p>
    </div>

    <div class="section">
        <h3>IV. CONDITIONS FINANCIÈRES</h3>
        <p><strong>Loyer mensuel :</strong> {{ rent_amount }} €<br><strong>Charges (prov.) :</strong> {{ charges_amount }} €<br><strong>Total :</strong> {{ total_amount }} €</p>
        <p>Exigible le 5 de chaque mois.</p>
    </div>

    <div class="section">
        <h3>V. GARANTIES</h3>
        <p><strong>Dépôt de garantie :</strong> {{ deposit_amount }} €</p>
        {% if guarantor_name %}
        <p><strong>Caution Solidaire :</strong> {{ guarantor_name }}</p>
        {% endif %}
    </div>

    <div class="section">
        <h3>VI. SIGNATURES</h3>
        <p>Fait à {{ property_city }}, le {{ today_date }}</p>
        <div class="signatures">
            <div class="sig-box"><p><strong>LE BAILLEUR</strong></p></div>
            <div class="sig-box"><p><strong>LE PRENEUR</strong></p></div>
        </div>
    </div>
</body>
</html>
"""

LEASE_COLOCATION_HTML = """
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Contrat de Colocation Meublée</title>
    <style>
        body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; line-height: 1.4; color: #000; max-width: 210mm; margin: 0 auto; padding: 20px; }
        h1 { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 5px; text-transform: uppercase; border: 2px solid #000; padding: 10px; }
        h2 { font-size: 12pt; font-weight: bold; margin-top: 20px; text-decoration: underline; background-color: #eee; padding: 5px; }
        .section { margin-bottom: 15px; }
        .value { font-weight: bold; }
        .signatures { margin-top: 40px; display: flex; justify-content: space-between; }
        .sig-box { width: 45%; border: 1px solid #000; padding: 10px; min-height: 100px; }
        .page-break { page-break-before: always; }
        .small { font-size: 9pt; font-style: italic; }
    </style>
</head>
<body>
    <h1>CONTRAT DE BAIL EN COLOCATION MEUBLEE<br><span style="font-size: 10pt; font-weight: normal;">SANS CLAUSE DE SOLIDARITE LOCATIVE ENTRE LES LOCATAIRES</span></h1>

    <div class="section">
        <h2>1 - DESIGNATION DES PARTIES</h2>
        <p><strong>LE BAILLEUR :</strong><br>{{ landlord_name }}<br>{{ landlord_address }}<br>{{ landlord_email }}</p>
        <p><strong>LE LOCATAIRE (Colocataire) :</strong><br>{{ tenant_name }}<br>{{ tenant_email }}</p>
        <p><strong>GARANT :</strong> {{ guarantor_name or "Non Applicable" }}</p>
    </div>

    <div class="section">
        <h2>2 - OBJET DU CONTRAT</h2>
        <p>Location d’une chambre meublée dans un appartement de {{ property_rooms }} pièces.</p>
        <p><strong>Adresse :</strong> {{ property_address }}</p>
        <p><strong>Usage :</strong> Habitation exclusive / Colocation.</p>
    </div>

    <div class="section">
        <h2>3 - DUREE</h2>
        <p>Prise d’effet : <strong>{{ start_date }}</strong>. Durée : <strong>{{ duration_text }}</strong>.</p>
    </div>

    <div class="section">
        <h2>4 - CONDITIONS FINANCIERES</h2>
        <p><strong>Loyer mensuel :</strong> {{ rent_amount }} €</p>
        <p><strong>Charges (Forfait) :</strong> {{ charges_amount }} €</p>
        <p><strong>Total :</strong> {{ total_amount }} €</p>
    </div>

    <div class="section">
        <h2>5 - DEPOT DE GARANTIE</h2>
        <p>Montant : <strong>{{ deposit_amount }} €</strong></p>
    </div>

    <div class="section">
        <h2>6 - SIGNATURES</h2>
        <p>Fait à {{ property_city }}, le {{ today_date }}</p>
        <div class="signatures">
            <div class="sig-box"><p><strong>LE BAILLEUR</strong><br>Lu et approuvé</p></div>
            <div class="sig-box"><p><strong>LE LOCATAIRE</strong><br>Lu et approuvé</p></div>
        </div>
    </div>
</body>
</html>
"""

LEASE_CODE_CIVIL_HTML = """
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Bail Code Civil</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; margin: 20mm; }
        h1 { text-align: center; font-size: 16pt; text-decoration: underline; margin-bottom: 30px; }
        h2 { font-size: 12pt; border-bottom: 1px solid #000; margin-top: 20px; }
        .section { margin-bottom: 10px; }
        .warning { border: 1px solid red; padding: 10px; font-weight: bold; text-align: center; margin: 20px 0; }
    </style>
</head>
<body>
    <h1>BAIL D’HABITATION (CODE CIVIL)</h1>
    <div class="warning">
        Sorti du champ d’application de la loi n°89-462 du 6 juillet 1989
    </div>

    <div class="section">
        <h2>ENTRE LES SOUSSIGNÉS</h2>
        <p><strong>Bailleur :</strong> {{ landlord_name }} ({{ landlord_email }})</p>
        <p><strong>Preneur :</strong> {{ tenant_name }} ({{ tenant_email }})</p>
    </div>

    <div class="section">
        <h2>OBJET</h2>
        <p><strong>Adresse :</strong> {{ property_address }}</p>
        <p><strong>Destination :</strong> Habitation (Résidence secondaire / Logement de fonction).</p>
        <p><strong>Exclusion :</strong> Ce contrat est régi par les articles 1714 à 1762 du Code Civil.</p>
    </div>

    <div class="section">
        <h2>DURÉE</h2>
        <p>Du <strong>{{ start_date }}</strong> pour une durée ferme de <strong>{{ duration_months }} mois</strong>.</p>
    </div>

    <div class="section">
        <h2>LOYER</h2>
        <p><strong>Loyer mensuel :</strong> {{ rent_amount }} € (Charges comprises: {{ charges_amount }} €)</p>
    </div>

    <div class="section">
        <h2>SIGNATURES</h2>
        <p>Fait à {{ property_city }}, le {{ today_date }}</p>
        <br><br>
        <table style="width: 100%;">
            <tr>
                <td style="width: 50%;"><strong>Le Bailleur</strong></td>
                <td style="width: 50%;"><strong>Le Preneur</strong></td>
            </tr>
        </table>
    </div>
</body>
</html>
"""

LEASE_SIMPLE_HTML = """
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Contrat de Location Simple</title>
    <style>
        body { font-family: Helvetica, sans-serif; font-size: 11pt; margin: 20mm; }
        h1 { text-align: center; font-size: 18pt; margin-bottom: 20px; }
        .field { margin-bottom: 10px; }
        .label { font-weight: bold; width: 150px; display: inline-block; }
    </style>
</head>
<body>
    <h1>CONTRAT DE LOCATION</h1>
    
    <div class="field"><span class="label">BAILLEUR :</span> {{ landlord_name }}</div>
    <div class="field"><span class="label">LOCATAIRE :</span> {{ tenant_name }}</div>
    
    <hr>
    
    <div class="field"><span class="label">ADRESSE :</span> {{ property_address }}</div>
    <div class="field"><span class="label">SURFACE :</span> {{ property_size }} m²</div>
    
    <hr>
    
    <div class="field"><span class="label">DÉBUT :</span> {{ start_date }}</div>
    <div class="field"><span class="label">DURÉE :</span> {{ duration_text }}</div>
    
    <hr>
    
    <div class="field"><span class="label">LOYER :</span> {{ rent_amount }} € CC</div>
    <div class="field"><span class="label">DÉPÔT :</span> {{ deposit_amount }} €</div>
    
    <br><br><br>
    <p>Fait le {{ today_date }} à {{ property_city }}.</p>
    <br>
    <p>Signature Bailleur : ____________________ &nbsp;&nbsp;&nbsp; Signature Locataire : ____________________</p>
</body>
</html>
"""

RENT_RECEIPT_HTML = """
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Quittance de Loyer</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 11pt; margin: 20mm; line-height: 1.5; }
        .header { text-align: center; border: 2px solid #000; padding: 10px; margin-bottom: 30px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .col { width: 45%; }
        .box { border: 1px solid #ccc; padding: 15px; border-radius: 5px; background: #f9f9f9; }
        .details { margin-top: 30px; }
        .total-box { text-align: right; font-size: 14pt; font-weight: bold; margin-top: 20px; }
        .footer { margin-top: 50px; font-size: 10pt; color: #555; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <h1>QUITTANCE DE LOYER</h1>
        <p>Période du <strong>{{ start_date }}</strong> au <strong>{{ end_date }}</strong></p>
    </div>

    <div class="row">
        <div class="col">
            <strong>LE BAILLEUR</strong><br>
            {{ landlord_name }}<br>
            {{ landlord_address }}
        </div>
        <div class="col" style="text-align: right;">
            <strong>LE LOCATAIRE</strong><br>
            {{ tenant_name }}<br>
            {{ tenant_address }}
        </div>
    </div>

    <div class="details box">
        <p><strong>Adresse de la location :</strong> {{ property_address }}</p>
        <p><strong>Date de paiement :</strong> {{ payment_date }}</p>
        
        <table style="width: 100%; margin-top: 20px;">
            <tr>
                <td>Loyer hors charges</td>
                <td style="text-align: right;">{{ rent_amount }} €</td>
            </tr>
            <tr>
                <td>Provision pour charges</td>
                <td style="text-align: right;">{{ charges_amount }} €</td>
            </tr>
            <tr style="font-weight: bold; border-top: 1px solid #000;">
                <td style="padding-top: 10px;">TOTAL PAYÉ</td>
                <td style="text-align: right; padding-top: 10px;">{{ total_amount }} €</td>
            </tr>
        </table>
    </div>
    
    <div class="footer">
        <p>Cette quittance annule tous les reçus qui auraient pu être donnés pour acompte versé sur le présent terme. Elle est remise sous réserve de tous droits et actions.</p>
        <p>Fait à {{ property_city }}, le {{ today_date }}</p>
        <br>
        <p><strong>Le Bailleur</strong></p>
        <img src="" alt="Signature" style="max-height: 50px;"> <!-- Placeholder for signature -->
    </div>
</body>
</html>
"""

EXIT_ATTESTATION_HTML = """
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Attestation de Fin de Bail</title>
    <style>
        body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; margin: 25mm; line-height: 1.6; }
        h1 { text-align: center; font-size: 14pt; margin-bottom: 40px; text-decoration: underline; }
        .content { text-align: justify; }
        .signature { margin-top: 50px; text-align: right; }
    </style>
</head>
<body>
    <div style="text-align: right; margin-bottom: 20px;">
        {{ landlord_name }}<br>
        {{ landlord_address }}<br>
        {{ landlord_city }}, le {{ today_date }}
    </div>

    <h1>ATTESTATION DE FIN DE BAIL</h1>

    <div class="content">
        <p>Bonjour,</p>
        
        <p>Je soussigné(e), <strong>{{ landlord_name }}</strong>, certifie par la présente que <strong>{{ tenant_name }}</strong> m'a notifié le {{ notice_date }} qu'il/elle quittait le logement situé au :</p>
        
        <p style="text-align: center; font-weight: bold;">{{ property_address }}</p>
        
        <p>Selon les termes du bail, M./Mme {{ tenant_name }} a quitté les lieux le <strong>{{ exit_date }}</strong>.</p>
        
        <p>Je certifie également que :</p>
        <ul>
            <li>Le locataire est à jour de ses loyers et charges jusqu'à la fin du bail.</li>
            <li>L'état des lieux de sortie a été effectué le {{ exit_date }}.</li>
            {% if deposit_returned %}
            <li>Le dépôt de garantie de {{ deposit_amount }} € a été restitué (déduction faite des éventuelles retenues justifiées).</li>
            {% endif %}
        </ul>

        <p>Cette attestation est délivrée pour servir et valoir ce que de droit.</p>
        
        <p>Cordialement,</p>
    </div>

    <div class="signature">
        <p><strong>{{ landlord_name }}</strong></p>
    </div>
</body>
</html>
"""

