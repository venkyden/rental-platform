export type Language = 'en' | 'fr';

export const translations = {
    en: {
        // Landing Page
        landing: {
            title: "Welcome to Rental Platform",
            subtitle: "AI-powered rental platform serving tenants and landlords with intelligent verification, matching, and lease generation.",
            getStarted: "Get Started",
            signIn: "Sign In",
            features: {
                verification: {
                    title: "Secure Verification",
                    desc: "Advanced identity and employment verification in minutes, not weeks."
                },
                matching: {
                    title: "AI-Powered Matching",
                    desc: "Smart algorithms match tenants with perfect properties instantly."
                },
                leases: {
                    title: "Digital Leases",
                    desc: "Generate and sign legally-binding leases in 5 minutes with AI."
                }
            }
        },
        // Onboarding
        onboarding: {
            title: "Welcome to Rental Platform",
            skip: "Skip for now",
            back: "Back",
            continue: "Continue",
            processing: "Processing your responses...",
            step: "Question {{current}} of {{total}}",
            questions: {
                tenant: {
                    situation: {
                        question: "What describes your situation best?",
                        options: {
                            student_budget: "I'm a student / Price-sensitive (D1)",
                            family_stability: "I want long-term stability (Family/Senior) (D2)",
                            flexibility_relocation: "I need flexibility (Remote Worker/International Student) (D3)"
                        }
                    },
                    location: {
                        question: "Where are you looking to rent?",
                        placeholder: "e.g., Paris, Lyon, Marseille..."
                    },
                    budget: {
                        question: "What's your monthly budget?"
                    },
                    lease_duration: {
                        question: "How long do you plan to stay?",
                        options: {
                            short_term: "Short-term (3-6 months)",
                            medium_term: "Medium-term (6-12 months)",
                            long_term: "Long-term (1-2 years)",
                            very_long_term: "Very long-term (2+ years)"
                        }
                    },
                    move_in_timeline: {
                        question: "When do you need to move in?",
                        options: {
                            asap: "ASAP (within 1 week)",
                            soon: "Soon (within 2-4 weeks)",
                            flexible: "Flexible (1-3 months)",
                            browsing: "Just browsing for now"
                        }
                    }
                },
                landlord: {
                    property_count: {
                        question: "How many properties do you own or manage?",
                        options: {
                            "1_4": "1-4 properties",
                            "5_100": "5-100 properties",
                            "100_plus": "100+ properties"
                        }
                    },
                    challenge: {
                        question: "What's your biggest challenge right now?",
                        options: {
                            finding_tenants: "Finding reliable tenants quickly",
                            avoiding_fraud: "Avoiding bad tenants / fraud",
                            regulations: "Understanding rental regulations",
                            all: "All of the above"
                        }
                    },
                    location: {
                        question: "Where are your properties located?",
                        placeholder: "e.g., Paris, Lyon, Nationwide..."
                    },
                    urgency: {
                        question: "When do you need to fill your next vacancy?",
                        options: {
                            urgent: "Urgently (within 2 weeks)",
                            soon: "Soon (within 1 month)",
                            planning: "Planning ahead (1-3 months)",
                            exploring: "Just exploring for now"
                        }
                    }
                }
            }
        },

        // Dashboard
        dashboard: {
            title: "Dashboard",
            welcome: "Welcome",
            logout: "Logout",
            role: {
                landlord: "Landlord",
                tenant: "Tenant"
            },
            stats: {
                trustScore: "Trust Score",
                improve: "Improve Score",
                complete: "Complete your profile to boost your score",
                verified: "Verified",
                pending: "Pending",
                notStarted: "Not started",
                properties: "Properties",
                activeListings: "Active Listings",
                drafts: "Drafts",
                views: "Total Views"
            },
            quickActions: {
                title: "Quick Actions",
                newProperty: {
                    title: "New Property",
                    desc: "List a new property"
                },
                browse: {
                    title: "Browse Properties",
                    desc: "Find your next home"
                },
                verify: {
                    title: "Complete Verification",
                    desc: "Verify your identity"
                },
                messages: {
                    title: "Messages",
                    desc: "View inbox"
                },
                onboarding: {
                    title: "Onboarding",
                    desc: "Complete your profile"
                }
            },
            inbox: {
                title: "Messages",
                viewAll: "View All",
                empty: "No messages",
                emptyDesc: "Your conversations will appear here"
            },
            verification: {
                title: "Verification Status",
                email: "Email Verification",
                identity: "Identity Verification",
                employment: "Employment Verification",
                start: "Start",
                verification: {
                    title: "Verification Status",
                    pageTitle: "Verification",
                    backToDashboard: "Back to Dashboard",
                    progress: "Verification Progress",
                    email: "Email",
                    identity: "Identity",
                    employment: "Employment",
                    verified: "Verified",
                    pending: "Pending",
                    start: "Start",
                    resend: "Resend",
                    sending: "Sending...",
                    tabs: {
                        identity: "Identity Verification",
                        employment: "Employment Verification"
                    },
                    success: {
                        identity: "Identity Verified!",
                        identityMsg: "Your identity has been successfully verified.",
                        employment: "Employment Verified!",
                        employmentMsg: "Your employment has been successfully verified."
                    }
                }
            },
            landlord: {
                welcome: "Welcome, {{name}}",
                subtitle: "Landlord Dashboard",
                onboarding: {
                    title: "Getting Started",
                    desc: "Add your first property to start receiving applications",
                    button: "Add Property"
                },
                sections: {
                    quickActions: "Quick Actions",
                    portfolio: "My Portfolio",
                    visits: "Visit Management",
                    gli: "Unpaid Rent Guarantee (GLI)",
                    analytics: "Analytics",
                    team: "My Team",
                    inbox: "Recent Messages"
                },
                widgets: {
                    visits: {
                        title: "Manage Visit Availability",
                        desc: "Define your visit slots to allow tenants to book.",
                        date: "Date",
                        startTime: "Start Time",
                        add: "Add Slot",
                        available: "Available Slots",
                        noSlots: "No slots defined yet.",
                        booked: "Booked"
                    },
                    gli: {
                        button: "️ Get GLI Quote",
                        title: "Unpaid Rent Guarantee",
                        subtitle: "Protection against unpaid rent",
                        rent: "Monthly Rent",
                        income: "Tenant Monthly Income",
                        ratio: "Ratio: {{ratio}}x rent",
                        min_ratio: "(min 3x)",
                        contract: "Contract Type",
                        verified_job: "Employment Verified",
                        verified_id: "Identity Verified",
                        calculate: "Calculate Quote",
                        calculating: "Calculating...",
                        eligible: "Eligible for GLI",
                        ineligible: "Not Eligible",
                        premium_monthly: "Monthly Premium",
                        premium_annual: "Annual Premium",
                        subscribe: "Subscribe Now",
                        success: "Application submitted! A counselor will contact you within 24h."
                    }
                }
            }
        },
        auth: {
            login: {
                title: "Login",
                subtitle: "Access your account",
                email: "Email Address",
                password: "Password",
                forgotPassword: "Forgot password?",
                submit: "Sign In",
                loading: "Signing in...",
                noAccount: "No account yet?",
                createAccount: "Create an account",
                error: "Login failed. Please try again."
            },
            register: {
                title: "Create Account",
                subtitle: "Join the platform",
                role: {
                    label: "I am a",
                    tenant: "Tenant",
                    tenantDesc: "I am looking for a home",
                    landlord: "Landlord",
                    landlordDesc: "I am renting a property",
                    manager: "Property Manager",
                    managerDesc: "I manage properties"
                },
                fullName: "Full Name",
                email: "Email Address",
                password: "Password",
                confirmPassword: "Confirm Password",
                passwordStrength: {
                    secure: "Secure password ",
                    criteria: "/5 criteria"
                },
                match: {
                    error: "Passwords do not match",
                    success: " Match"
                },
                consent: {
                    gdpr: "I accept the Privacy Policy and Terms",
                    error: "You must accept the Privacy Policy",
                    marketing: "Receive offers and news (optional)"
                },
                submit: "Create my account",
                loading: "Creating...",
                hasAccount: "Already have an account?",
                signIn: "Sign In",
                error: "Registration failed. Please try again."
            }
        },
        profile: {
            title: "My Profile",
            back: "Back",
            accountSettings: "Account Settings",
            notifications: "Notifications",
            privacy: "Privacy (GDPR)",
            logout: "Logout"
        },
        property: {
            new: {
                title: "Add New Property",
                subtitle: "Setup your listing in a few simple steps.",
                backToProperties: "Back to properties",
                step: "Step",
                cancel: "Cancel",
                next: "Next",
                prev: "Previous",
                submit: "Create Property",
                creating: "Creating...",
                success: "Property created successfully!",
                viewListing: "View Listing",
                steps: {
                    basic: {
                        title: "Basic Information",
                        listingTitle: "Listing Title",
                        propertyType: "Property Type",
                        description: "Description",
                        placeholder: {
                            title: "ex: Charming 1-bedroom in Paris center",
                            desc: "Describe the highlights of your property..."
                        }
                    },
                    location: {
                        title: "Location",
                        address: "Address",
                        complement: "Address Complement",
                        city: "City",
                        zip: "Postal Code",
                        enrich: {
                            title: "Automatic Enrichment",
                            desc: "Automatically detect nearby transport and landmarks.",
                            button: "Detect surroundings",
                            loading: "Detecting...",
                            found: "found"
                        }
                    },
                    review: {
                        title: "Summary",
                        surface: "Surface",
                        bedrooms: "Bedrooms",
                        type: "Type"
                    }
                },
                types: {
                    apartment: "Apartment",
                    house: "House",
                    studio: "Studio",
                    room: "Room"
                }
            }
        },
        "dossier": {
                "category": {
                        "identity": "Identity",
                        "address": "Address",
                        "status": "Status",
                        "income": "Income",
                        "guarantor": "Guarantor (If applicable)"
                },
                "item": {
                        "identity": "ID Document (ID Card, Passport)",
                        "proof_of_address": "Proof of Address (< 3 months)",
                        "student_card": "Student Card / Enrollment Certificate",
                        "employer_certificate": "Employer Certificate / Contract",
                        "pays_slip": "Last 3 Pay Slips",
                        "scholarship_proof": "Scholarship Notice",
                        "tax_notice": "Latest Tax Notice",
                        "guarantor_identity": "Guarantor ID Document",
                        "guarantor_proof_address": "Guarantor Proof of Address",
                        "guarantor_activity": "Guarantor Employment Proof",
                        "guarantor_income": "Guarantor Income Proof (> 3x rent)"
                },
                "error": {
                        "loading": "Error loading documents",
                        "upload": "Upload failed"
                },
                "success": {
                        "upload": "Document added!"
                },
                "loading": "Loading dossier...",
                "title": "My Rental Application File",
                "subtitle": "Compliant with housing regulations. A complete file increases your chances by 80%.",
                "status": {
                        "received": "Received",
                        "missing": "Missing"
                },
                "action": {
                        "uploading": "Uploading...",
                        "add": "Add"
                },
                "prohibited": {
                        "title": "Prohibited Documents (Never submit):",
                        "item1": "Social Security Card",
                        "item2": "Bank Account Statements",
                        "item3": "Direct Debit Authorization (before lease signing)",
                        "item4": "Medical Records / Criminal Record",
                        "item5": "Reservation Check"
                }
        },
        "emailVerification": {
                "loading": "Loading...",
                "title": "Verify Your Email",
                "sentMessage1": "We've sent a verification link to",
                "sentMessage2": " Please check your inbox and click the link to continue.",
                "success": "Verification email sent!",
                "sending": "Sending...",
                "resendButton": "Resend Verification Email",
                "alreadyVerified": "I've verified my email →",
                "differentAccount": "Sign in with a different account",
                "spamFolder": "Can't find the email? Check your spam folder or request a new one."
        },
        "actionCenter": {
                "allInOrder": "All is in order",
                "noUrgentAction": "No urgent action required"
        },
        "visitBooking": {
                "success": {
                        "booked": "Visit booked successfully!"
                },
                "error": {
                        "bookingFailed": "Booking failed. Slot might be taken."
                },
                "confirmed": {
                        "title": "Visit Confirmed!",
                        "desc": "Your virtual tour is scheduled. You will receive an email confirmation.",
                        "joinButton": "Join Video Call",
                        "secureLink": "Secure link via Jitsi Meet"
                },
                "title": "Schedule a Visit",
                "slotsAvailable": "slots available",
                "backToRooms": "Back to rooms",
                "noSlots": "No availability listed yet.",
                "bookingInProgress": "Booking...",
                "confirmButton": "Confirm Visit",
                "reserveInstantly": "Reserve this slot instantly.",
                "selectTimeSlot": "Select a time slot."
        },
        "cameraCapture": {
                "accessDenied": "Camera access denied. Please allow camera access to verify your identity.",
                "title": "Capture Identity Document",
                "liveCaptureTitle": "Live Document Capture",
                "liveCaptureDesc": "For security, we require a live photo of your ID document.",
                "liveCaptureTip": "Position your document clearly and ensure all text is readable.",
                "openCamera": "Open Camera",
                "cancel": "Cancel",
                "captureButton": "Capture Photo",
                "frameTip": "Tip: Ensure your document is well-lit and all corners are visible within the blue frame."
        },
        "conversation": {
                "notFound": "Conversation not found",
                "archiveButton": "Archive",
                "landlord": "Landlord",
                "tenant": "Tenant",
                "viewProperty": "View Property →",
                "downloadLease": "Download Lease",
                "writeMessage": "Write a message...",
                "archivedNotice": "This conversation is archived"
        },
        "lease": {
                "meuble": {
                        "name": "Furnished Rental",
                        "desc": "Standard lease for furnished property",
                        "duration": "1 year (renewable)",
                        "tenantNotice": "1 month",
                        "landlordNotice": "3 months",
                        "depositInfo": "2 months max"
                },
                "vide": {
                        "name": "Unfurnished Rental",
                        "desc": "Lease for unfurnished property",
                        "duration": "3 years (renewable)",
                        "tenantNotice": "3 months",
                        "landlordNotice": "6 months",
                        "depositInfo": "1 month max"
                },
                "mobilite": {
                        "name": "Mobility Lease",
                        "desc": "Short term (students, interns, relocation)",
                        "duration": "1-10 months (non-renewable)",
                        "tenantNotice": "1 month",
                        "landlordNotice": "Not applicable",
                        "depositInfo": "Forbidden"
                },
                "etudiant": {
                        "name": "Student Lease",
                        "desc": "Specific for students",
                        "duration": "9 months (non-renewable)",
                        "tenantNotice": "1 month",
                        "landlordNotice": "Not applicable",
                        "depositInfo": "2 months max"
                },
                "error": {
                        "missingFields": "Please fill all required fields",
                        "generationFailed": "Error generating lease"
                },
                "title": "Generate a Lease",
                "leaseType": "Lease Type",
                "duration": "Duration",
                "deposit": "Deposit",
                "tenantNotice": "Tenant Notice",
                "landlordNotice": "Landlord Notice",
                "mobiliteDuration": "Duration (1-10 months)",
                "tenantEmail": "Tenant Email",
                "startDate": "Lease Start Date",
                "financialConditions": "Financial Conditions",
                "monthlyRent": "Monthly Rent",
                "charges": "Charges",
                "securityDeposit": "Security Deposit",
                "generating": "Generating...",
                "generateButton": "Generate Lease Contract",
                "success": "Lease generated!",
                "successDesc": "The contract includes all required clauses: notice periods, end of lease conditions, security deposit, obligations of both parties, inventory, and termination clause.",
                "downloadPdf": "Download PDF"
        },
        "docs": {
                "student_id": " Student ID / Enrollment Certificate",
                "internship_contract": " Internship Agreement",
                "scholarship": " Scholarship Notice",
                "caf": " Housing Aid Simulation (CAF/MSA)",
                "kbis": " Kbis Extract (less than 3 months)",
                "tax_return": " Latest Tax Return",
                "accounting": " Latest Accounting Balance",
                "benefits": " Social / Family Benefits",
                "pension": " Pension Proof",
                "payslip": " Last 3 Payslips",
                "contract": " Employment Contract / Certificate",
                "passport": " Passport",
                "id_card": " National ID Card",
                "residence_permit": " Residence Permit"
        }
    },
    fr: {
        "dossier": {
                "category": {
                        "identity": "Identité",
                        "address": "Adresse",
                        "status": "Statut",
                        "income": "Revenus",
                        "guarantor": "Garant (Si applicable)"
                },
                "item": {
                        "identity": "Pièce d'identité (CNI, Passeport)",
                        "proof_of_address": "Justificatif de domicile (< 3 mois)",
                        "student_card": "Carte étudiante / Certificat de scolarité",
                        "employer_certificate": "Attestation employeur / Contrat",
                        "pays_slip": "3 derniers bulletins de paie",
                        "scholarship_proof": "Avis de bourse",
                        "tax_notice": "Dernier avis d'imposition",
                        "guarantor_identity": "Pièce d'identité du garant",
                        "guarantor_proof_address": "Justificatif de domicile du garant",
                        "guarantor_activity": "Justificatif d'activité du garant",
                        "guarantor_income": "Justificatif de revenus du garant (> 3x loyer)"
                },
                "error": {
                        "loading": "Erreur lors du chargement des documents",
                        "upload": "Échec du téléchargement"
                },
                "success": {
                        "upload": "Document ajouté !"
                },
                "loading": "Chargement du dossier...",
                "title": "Mon dossier de location",
                "subtitle": "Conforme à la réglementation. Un dossier complet augmente vos chances de 80%.",
                "status": {
                        "received": "Reçu",
                        "missing": "Manquant"
                },
                "action": {
                        "uploading": "Envoi en cours...",
                        "add": "Ajouter"
                },
                "prohibited": {
                        "title": "Documents interdits (Ne jamais soumettre) :",
                        "item1": "Carte Vitale",
                        "item2": "Relevés de compte bancaire",
                        "item3": "Autorisation de prélèvement (avant signature du bail)",
                        "item4": "Dossier médical / Casier judiciaire",
                        "item5": "Chèque de réservation"
                }
        },
        "emailVerification": {
                "loading": "Chargement...",
                "title": "Vérifiez votre e-mail",
                "sentMessage1": "Nous avons envoyé un lien de vérification à",
                "sentMessage2": " Veuillez vérifier votre boîte de réception et cliquer sur le lien pour continuer.",
                "success": "E-mail de vérification envoyé !",
                "sending": "Envoi en cours...",
                "resendButton": "Renvoyer l'e-mail de vérification",
                "alreadyVerified": "J'ai vérifié mon e-mail →",
                "differentAccount": "Se connecter avec un autre compte",
                "spamFolder": "Vous ne trouvez pas l'e-mail ? Vérifiez vos spams ou demandez-en un nouveau."
        },
        "actionCenter": {
                "allInOrder": "Tout est en ordre",
                "noUrgentAction": "Aucune action urgente requise"
        },
        "visitBooking": {
                "success": {
                        "booked": "Visite réservée avec succès !"
                },
                "error": {
                        "bookingFailed": "Échec de la réservation. Le créneau est peut-être pris."
                },
                "confirmed": {
                        "title": "Visite confirmée !",
                        "desc": "Votre visite virtuelle est programmée. Vous recevrez une confirmation par e-mail.",
                        "joinButton": "Rejoindre l'appel vidéo",
                        "secureLink": "Lien sécurisé via Jitsi Meet"
                },
                "title": "Programmer une visite",
                "slotsAvailable": "créneaux disponibles",
                "backToRooms": "Retour aux chambres",
                "noSlots": "Aucune disponibilité pour le moment.",
                "bookingInProgress": "Réservation...",
                "confirmButton": "Confirmer la visite",
                "reserveInstantly": "Réservez ce créneau instantanément.",
                "selectTimeSlot": "Sélectionnez un créneau horaire."
        },
        "cameraCapture": {
                "accessDenied": "Accès à la caméra refusé. Veuillez autoriser l'accès pour vérifier votre identité.",
                "title": "Capturer une pièce d'identité",
                "liveCaptureTitle": "Capture de document en direct",
                "liveCaptureDesc": "Par sécurité, nous exigeons une photo en direct de votre pièce d'identité.",
                "liveCaptureTip": "Positionnez votre document clairement et assurez-vous que tout le texte est lisible.",
                "openCamera": "Ouvrir la caméra",
                "cancel": "Annuler",
                "captureButton": "Capturer la photo",
                "frameTip": "Astuce : Assurez-vous que votre document est bien éclairé et que tous les coins sont visibles dans le cadre bleu."
        },
        "conversation": {
                "notFound": "Conversation introuvable",
                "archiveButton": "Archiver",
                "landlord": "Propriétaire",
                "tenant": "Locataire",
                "viewProperty": "Voir le bien →",
                "downloadLease": "Télécharger le bail",
                "writeMessage": "Écrire un message...",
                "archivedNotice": "Cette conversation est archivée"
        },
        "lease": {
                "meuble": {
                        "name": "Location meublée",
                        "desc": "Bail standard pour bien meublé",
                        "duration": "1 an (renouvelable)",
                        "tenantNotice": "1 mois",
                        "landlordNotice": "3 mois",
                        "depositInfo": "2 mois max"
                },
                "vide": {
                        "name": "Location vide",
                        "desc": "Bail pour bien non meublé",
                        "duration": "3 ans (renouvelable)",
                        "tenantNotice": "3 mois",
                        "landlordNotice": "6 mois",
                        "depositInfo": "1 mois max"
                },
                "mobilite": {
                        "name": "Bail mobilité",
                        "desc": "Courte durée (étudiants, stagiaires, mutation)",
                        "duration": "1-10 mois (non renouvelable)",
                        "tenantNotice": "1 mois",
                        "landlordNotice": "Non applicable",
                        "depositInfo": "Interdit"
                },
                "etudiant": {
                        "name": "Bail étudiant",
                        "desc": "Spécifique aux étudiants",
                        "duration": "9 mois (non renouvelable)",
                        "tenantNotice": "1 mois",
                        "landlordNotice": "Non applicable",
                        "depositInfo": "2 mois max"
                },
                "error": {
                        "missingFields": "Veuillez remplir tous les champs obligatoires",
                        "generationFailed": "Erreur lors de la génération du bail"
                },
                "title": "Générer un bail",
                "leaseType": "Type de bail",
                "duration": "Durée",
                "deposit": "Dépôt de garantie",
                "tenantNotice": "Préavis locataire",
                "landlordNotice": "Préavis propriétaire",
                "mobiliteDuration": "Durée (1-10 mois)",
                "tenantEmail": "Email du locataire",
                "startDate": "Date de début du bail",
                "financialConditions": "Conditions financières",
                "monthlyRent": "Loyer mensuel",
                "charges": "Charges",
                "securityDeposit": "Dépôt de garantie",
                "generating": "Génération...",
                "generateButton": "Générer le contrat de bail",
                "success": "Bail généré !",
                "successDesc": "Le contrat inclut toutes les clauses obligatoires : préavis, conditions de fin de bail, dépôt de garantie, obligations, état des lieux et clause résolutoire.",
                "downloadPdf": "Télécharger le PDF"
        },
        "docs": {
                "student_id": " Carte étudiante / Certificat de scolarité",
                "internship_contract": " Convention de stage",
                "scholarship": " Avis de bourse",
                "caf": " Simulation d'aide au logement (CAF/MSA)",
                "kbis": " Extrait Kbis (moins de 3 mois)",
                "tax_return": " Dernier avis d'imposition",
                "accounting": " Dernier bilan comptable",
                "benefits": " Prestations sociales / familiales",
                "pension": " Justificatif de retraite",
                "payslip": " 3 derniers bulletins de paie",
                "contract": " Contrat de travail / Attestation employeur",
                "passport": " Passeport",
                "id_card": " Carte nationale d'identité",
                "residence_permit": " Titre de séjour"
        }
}
};
