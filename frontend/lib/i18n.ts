export type Language = 'en' | 'fr';

export const translations = {
    en: {
        // Landing Page
        landing: {
            title: "Welcome to Roomivo",
            subtitle: "Identity verification, smart matching, and digital leases — everything you need to rent safely in France.",
            getStarted: "Get Started",
            signIn: "Sign In",
            hero: {
                title: "Find your perfect home with confidence",
                subtitle: "The all-in-one platform for secure rentals in France."
            },
            howItWorks: {
                title: "How It Works",
                subtitle: "Three simple steps to find your ideal home or perfect tenant.",
                steps: {
                    profile: { title: "Create Your Profile", desc: "Sign up and verify your identity in minutes." },
                    matching: { title: "Smart Matching", desc: "Our algorithm suggests the best matches based on your criteria." },
                    lease: { title: "Digital Lease", desc: "Generate a legally-compliant French lease contract in a few clicks." }
                }
            },
            cta: {
                tenant: { title: "Looking for a home?", desc: "Build your digital dossier and apply in one click.", button: "I'm a tenant" },
                landlord: { title: "Are you a landlord?", desc: "List your properties and receive verified applications.", button: "I'm a landlord" }
            }
        },
        common: {
            save: "Save",
            cancel: "Cancel",
            delete: "Delete",
            edit: "Edit",
            view: "View",
            manage: "Manage",
            viewAll: "View all",
            back: "Back",
            next: "Next",
            submit: "Submit",
            loading: "Loading...",
            requiredByLaw: "Required by Law",
            actions: {
                profile: "My Profile",
                verification: "ID Verification",
                documents: "Documents",
                help: "Help",
                toComplete: "To complete"
            },
            verification: {
                title: "Profile Verification",
                email: "Email",
                questionnaire: "Questionnaire",
                identity: "Identity",
                employment: "Employment"
            },
            placeholders: {
                fullName: "John Doe",
                bio: "A bit about yourself...",
                email: "name@company.com",
                phone: "+33 6 12 34 56 78",
                password: "••••••••",
                newPassword: "Enter new password",
                confirmPassword: "Confirm new password",
                delete: "Type DELETE",
                address: "Start typing an address in France…",
                addressLine2: "Apartment, suite, etc. (optional)",
                description: "Describe your property...",
                kitchenSink: "e.g. Kitchen Sink",
                school: "Enter your school/university name",
                city: "City (e.g., Paris, Lyon...)",
                guarantorName: "Guarantor full name (Optional)",
                guarantorEmail: "guarantor@email.com",
                tenantEmail: "tenant@email.com",
                workplaceAddress: "Start typing your workplace address...",
                year: "e.g., 1985",
                charges: "Ex: Eau froide, entretien parties communes...",
                disputeObservations: "Enter factual observations about the evidence...",
                search: "Search...",
                selectOption: "Select an option...",
                selectUniversity: "Select your university...",
                url: "https://..."
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
                            student_budget: "🎓 Student",
                            family_stability: "👨‍👩‍👧‍👦 Employee/Family",
                            flexibility_relocation: "💻 Freelancer/Remote",
                            other: "❓ Other"
                        }
                    },
                    workplace: {
                        question: "Where do you work?"
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

        actionCenter: {
            allInOrder: "All is in order",
            noUrgentAction: "No urgent action required"
        },
        emailVerification: {
            loading: "Loading...",
            title: "Verify Your Email",
            sentMessage1: "We've sent a verification link to",
            sentMessage2: " Please check your inbox and click the link to continue.",
            success: "Verification email sent!",
            sending: "Sending...",
            resendButton: "Resend Verification Email",
            alreadyVerified: "I've verified my email →",
            differentAccount: "Sign in with a different account",
            spamFolder: "Can't find the email? Check your spam folder or request a new one."
        },

        visitBooking: {
            title: "Schedule a Visit",
            success: { booked: "Visit booked successfully!" },
            error: { bookingFailed: "Booking failed. Slot might be taken." },
            confirmed: {
                title: "Visit Confirmed!",
                desc: "Your virtual tour is scheduled. You will receive an email confirmation.",
                joinButton: "Join Video Call",
                secureLink: "Secure link via Jitsi Meet"
            },
            selectRoomDesc: "Which room would you like to visit?",
            slotsAvailable: "slot{{count}} available",
            backToRooms: "Back to rooms",
            noSlots: "No availability listed yet.",
            bookingInProgress: "Booking...",
            confirmButton: "Confirm Visit",
            reserveInstantly: "Reserve this slot instantly.",
            selectTimeSlot: "Select a time slot."
        },

        // Dashboard
        dashboard: {
            title: "Dashboard",
            welcome: "Welcome",
            welcome_desc: "Here's what's happening with your rental journey today.",
            logout: "Sign out",
            role: {
                landlord: "Landlord Mode",
                tenant: "Tenant Mode"
            },
            stats: {
                properties: "Properties",
                propertiesDesc: "All your listings",
                activeListings: "Active",
                activeDesc: "Live on platform",
                drafts: "Drafts",
                draftsDesc: "Pending publication",
                views: "Total Views",
                viewsDesc: "All time",
                trustScore: "Trust Score",
                complete: "Complete verifications to boost your score",
                verified: "Your trust score is perfect!",
                improve: "Improve Score"
            },
            quickActions: {
                title: "Quick Actions",
                my_disputes: "My Disputes",
                property_disputes: "Property Disputes",
                disputes: "Disputes",
                applications: "Applications",
                messages: "Messages",
                search: "Search",
                team: "Team",
                analytics: "Analytics",
                browse: { title: "Browse Properties", desc: "Find your next home" },
                newProperty: { title: "New Property", desc: "List a new property" },
                verify: { title: "Complete Verification", desc: "Verify your identity" },
                messages: { title: "Messages", desc: "View inbox" },
                onboarding: { title: "Onboarding", desc: "Complete your profile" },
                team: { title: "Team Management", desc: "Manage collaborators" },
                analytics: { title: "Analytics", desc: "Portfolio performance" },
                gli: { title: "Rent Guarantee", desc: "Protect your income" }
            },
            verification: {
                email: "Email Verification",
                identity: "Identity Verification",
                employment: "Employment Verification",
                verified: "Verified",
                pending: "Pending",
                start: "Start Verification",
                progressLabel: "Verification Progress",
                resend: "Resend Email",
                sending: "Sending...",
                toast: {
                    success: "Verification email sent! Check your inbox."
                },
                verification: {
                    title: "Verification Status",
                    pageTitle: "Verification",
                    backToDashboard: "Back to Dashboard",
                    progressLabel: "Verification Progress",
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
                        employment: "Employment Verification",
                        employmentMsg: "Your employment has been successfully verified."
                    },
                    property_title: "Property Ownership Verification",
                    property_desc: "Please upload proof of property ownership (deed or property tax)",
                    identity_desc: "For security, please capture live photos of your official ID",
                    employment_desc: "Upload your professional or financial documents",
                    legalDisclaimerDesc: "Your documents are encrypted and stored securely. We use industry-best security practices to protect your privacy.",
                    progress: {
                        title: "Verification Progress",
                        email: "Email",
                        identity: "Identity",
                        employment: "Employment",
                        trustScore: "Trust Score"
                    },
                    actions: {
                        back: "Back to Dashboard",
                        retake: "Retake Photos",
                        uploadSecurely: "Securely Upload & Verify",
                        uploading: "Uploading & Verifying...",
                        mobileWaiting: "Waiting for mobile capture...",
                        generatingSession: "Generating secure session...",
                        copy: "Copy",
                        howItWorks: "How it works:",
                        scanQr: "Scan the QR code with your phone",
                        selectDoc: "Select your document type",
                        takePhoto: "Take a clear photo of the document",
                        autoUpdate: "This page will update automatically"
                    }
                }
            },
            inbox: {
                title: "Inbox",
                unread: "unread",
                viewAll: "View all",
                empty: "No messages yet",
                emptyDesc: "Your conversation history with tenants and landlords will appear here.",
                selectPrompt: "Select a conversation",
                selectDesc: "Click on a conversation to see messages",
                searchPlaceholder: "Search...",
                filters: {
                    all: "All",
                    active: "Active",
                    archived: "Archived"
                },
                status: {
                    noConversations: "No Conversations",
                    noConversationsDesc: "You don't have any messages yet. Tenant inquiries will appear here."
                },
                time: {
                    yesterday: "Yesterday"
                },
                tenant: {
                    activity: "My Activity",
                    applications: "Applications",
                    visits: "Scheduled Visits",
                    favorites: "Favorites",
                    activeDisputes: "Active Disputes",
                    premiumTitle: "Premium Services",
                    premiumDesc: "Take advantage of our relocation services for your professional mobility",
                    discover: "Discover",
                    recentSearches: "Recent Searches",
                    noSearches: "You haven't made any searches yet.",
                    searchButton: "Search for a property"
                },
                landlord: {
                    welcome: "Welcome, {{name}}",
                    title: "Landlord Dashboard",
                    gettingStarted: "Getting Started",
                    gettingStartedDesc: "Add your first property to start receiving applications",
                    addProperty: "Add a Property",
                    portfolio: "My Portfolio",
                    activeProperties: "Active Properties",
                    applications: "Applications",
                    visits: "Scheduled Visits",
                    messages: "Messages",
                    activeDisputes: "Active Disputes",
                    analytics: "Analytics",
                    viewsMonth: "Views This Month",
                    occupancyRate: "Occupancy Rate",
                    revenue: "Monthly Revenue",
                    viewDetailed: "View detailed analytics",
                    myTeam: "My Team",
                    collaborate: "Collaborate efficiently",
                    collaborateDesc: "Invite collaborators to manage your properties together.",
                    inviteMember: "Invite a Member",
                    recentMessages: "Recent Messages",
                    noMessages: "No new messages yet."
                },
                agency: {
                    enterpriseActions: "Enterprise Actions",
                    bulkImport: "Bulk Import",
                    csvXml: "CSV / XML",
                    gliQuote: "GLI Quote",
                    rentGuarantee: "Rent Guarantee Insurance",
                    erpIntegration: "ERP Integration",
                    webhooksApi: "Webhooks API",
                    team: "Team",
                    accessManagement: "Access Management",
                    overview: "Overview",
                    activeMandates: "Active Mandates",
                    leased: "Leased",
                    applications: "Applications",
                    webhooks: "Webhooks",
                    members: "Members",
                    analytics: "Analytics",
                    export: "Export",
                    totalViews: "Total Views",
                    conversionRate: "Conversion Rate",
                    avgRentalTime: "Avg. Rental Time",
                    managedRevenue: "Managed Revenue",
                    recentActivity: "Recent Activity",
                    noActivity: "No recent activity",
                    compliance: "Compliance & Verifications",
                    kbisRegistration: "Kbis Registration",
                    verifiedStatus: "Verified Company Status",
                    kbisRequired: "Extract less than 3 months old required",
                    uploadKbis: "Upload Kbis",
                    carteG: "Carte G (Professional License)",
                    verifiedLicense: "Verified Property Management License",
                    carteGRequired: "Required for property management in France",
                    uploadCarteG: "Upload Carte G"
                }
            },
            
            globalFooter: {
                terms: "Terms of Service",
                privacy: "Privacy & CNIL",
                cookies: "Cookie Policy",
                gdpr: "GDPR Rights",
                help: "Help Center",
                rights: "All rights reserved."
            },
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
            },
        },
        analytics: {
            subtitle: "Track your property performance and financial growth.",
            totalViews: "Total Views",
            occupancy: "Occupancy Rate",
            potentialRevenue: "Potential Revenue",
            activeListings: "Active Listings",
            viewsOverTime: "Views Over Time",
            demographics: "Tenant Demographics",
            chartNotice: "Interactive charts are being generated for your portfolio. Check back in a few hours.",
            demoNotice: "Understand who is looking at your properties to optimize your marketing.",
            periods: {
                d7: "7D",
                d30: "30D",
                d90: "90D",
                y1: "1Y"
            }
        },
        gli: {
            subtitle: "Protect your rental income against unpaid rent and property damage.",
            selectProperty: "Select a Property"
        },
        facilitation: {
            title: "Facilitation Panel",
            subtitle: "Preserve evidence and redirect parties to official mediation.",
            neutralNotice: "Roomivo is a neutral facilitator. No verdicts.",
            allClear: "All clear",
            noDisputes: "No active disputes to facilitate.",
            reviewDetails: "Review Details",
            backToList: "Back to List",
            evidence: "Evidence",
            inventoryDiff: "Inventory Diff",
            lateFiling: "Late Filing",
            reporter: "Reporter",
            accused: "Accused",
            reporterEvidence: "Reporter Evidence",
            counterResponse: "Counter-Response",
            noResponse: "No response submitted yet.",
            conditionComparison: "Condition Comparison",
            item: "Item",
            before: "Before",
            after: "After",
            status: "Status",
            observations: "Observations (Internal/Neutral)",
            updateStatus: "Update Status",
            mediationLink: "Mediation Link (Redirect)",
            updateObservations: "Update Observations",
            finalizeClose: "Finalize & Close",
            geoVerification: "Geo-Verification",
            distanceFromProperty: "{{distance}}m from property",
            alurCheck: "Loi ALUR Check",
            alurNotice: "Deductions for normal wear & tear are prohibited. Landlords have 2 months max to return deposit if discrepancies exist.",
            filters: {
                all: "All",
                open: "Open",
                awaiting: "Awaiting",
                review: "Review",
                closed: "Closed"
            },
            categories: {
                damage: "Damage",
                unpaid_rent: "Unpaid Rent",
                other: "Other"
            },
            moveIn: "MOVE-IN",
            moveOut: "MOVE-OUT",
            distance: "Distance",
            verified: "Verified",
            unverified: "Unverified"
        },
        guide: {
            back: "Back",
            resourceCenter: "Resource Center",
            title: "Guides & Tips",
            subtitle: "Discover our articles to help with your real estate project.",
            tenant: {
                title: "Tenant's Guide",
                description: "Understanding the application, guarantors, and lease."
            },
            landlord: {
                title: "Pricing Guide (Landlord)",
                description: "Market trends and rent estimation."
            }
        },
        auth: {
            login: {
                title: "Welcome back",
                subtitle: "Access your account",
                email: "Email address",
                password: "Password",
                forgotPassword: "Forgot password?",
                forgotEmail: "Forgot email?",
                submit: "Sign in securely",
                loading: "Signing in...",
                signingIn: "Signing in...",
                noAccount: "Don't have an account?",
                signUp: "Create one now",
                createAccount: "Create an account",
                connectingGoogle: "Connecting to Google...",
                divider: "or sign in with email",
                signIn: "Sign in securely",
                error: {
                    google: "Google sign-in did not return a credential. Please try again.",
                    googleFail: "Google sign-in failed. Please try again.",
                    googleScript: "Could not load Google Sign-In. Please use email login.",
                    loginFail: "Login failed. Please try again."
                }
            },
            register: {
                title: "Create your account",
                subtitle: "Join the platform",
                hasAccount: "Already have an account?",
                signIn: "Sign in instead",
                fullName: "Full Name",
                phone: "Phone Number",
                optional: "(optional)",
                phoneDesc: "Used to recover your account if you forget your email",
                email: "Email address",
                password: "Password",
                confirmPassword: "Confirm Password",
                passwordHint: "At least 8 characters",
                passwordStrength: {
                    secure: "Secure password ",
                    criteria: "/5 criteria"
                },
                match: {
                    error: "Passwords do not match",
                    success: " Match"
                },
                accept: "I accept the",
                privacy: "Privacy Policy",
                and: "and",
                terms: "Terms of Service",
                consent: {
                    gdpr: "I accept the Privacy Policy and Terms",
                    error: "You must accept the Privacy Policy",
                    marketing: "Receive offers and news (optional)"
                },
                signingUp: "Creating account...",
                signUp: "Create account",
                submit: "Create my account",
                loading: "Creating account...",
                connectingGoogle: "Creating account with Google...",
                divider: "or create with email",
                role: {
                    label: "I am a",
                    question: "I am a",
                    tenant: "Tenant",
                    tenantDesc: "I am looking for a home",
                    landlord: "Landlord",
                    landlordDesc: "I am renting a property",
                    manager: "Property Manager",
                    managerDesc: "I manage properties"
                },
                error: {
                    privacy: "You must accept the Privacy Policy to create an account",
                    mismatch: "Passwords do not match",
                    security: "Password does not meet security requirements",
                    fail: "Registration failed. Please try again."
                }
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
            create: {
                title: "Add New Property",
                subtitle: "Setup your listing in a few simple steps.",
                back: "Back to properties",
                steps: {
                    basic: "Basic Information",
                    location: "Location",
                    details: "Property Details",
                    layout: "Room Layout",
                    pricing: "Pricing & Terms",
                    features: "Features & Amenities",
                    review: "Final Review"
                },
                basic: {
                    title: "Basic Information",
                    propertyTitle: "Property Title",
                    propertyTitlePlaceholder: "ex: Charming 1-bedroom in Paris center",
                    propertyType: "Property Type",
                    description: "Property Description",
                    descriptionPlaceholder: "Describe the highlights of your property...",
                    type: "Type"
                },
                location: {
                    title: "Property Location",
                    address: "Street Address",
                    addressPlaceholder: "Start typing your address...",
                    addressLine2: "Building, Floor, Suite",
                    addressLine2Placeholder: "Optional",
                    city: "City",
                    postalCode: "Postal Code",
                    autoDetect: "Automatic Detection",
                    autoDetectDesc: "Use AI to detect nearby transport and landmarks from your address.",
                    autoDetectBtn: "Detect Surroundings",
                    detecting: "Detecting...",
                    found: "{{count}} transport links found",
                    foundLandmarks: "{{count}} landmarks found"
                },
                details: {
                    title: "Property Details",
                    bedrooms: "Bedrooms",
                    bathrooms: "Bathrooms",
                    size: "Living Area (m²)",
                    floor: "Floor Number",
                    furnished: "Furnished Property",
                    energyRatingTitle: "Energy Performance (DPE)",
                    energyRatingDesc: "French law requires displaying energy efficiency for all listings.",
                    dpeLabel: "Energy Rating (DPE)",
                    gesLabel: "GHG Emission (GES)",
                    dpePlaceholder: "Select rating",
                    surfaceType: "Surface Measurement Type",
                    loiCarrezDesc: "Official measurement required for condominiums.",
                    constructionYear: "Year of Construction"
                },
                layout: {
                    title: "Room Layout & Capacity",
                    globalTitle: "General Information",
                    capacity: "Total Occupancy",
                    pieces: "Total Rooms (Pièces)",
                    livingRoom: "Living Room Size (m²)",
                    kitchen: "Kitchen Type",
                    commonAreas: "Common Areas",
                    bedroomTitle: "Bedroom {{number}}",
                    bedroomDetails: "Bed details & Surface",
                    bedroomDesc: "Room Description",
                    surface: "Surface (m²)",
                    roomCapacity: "Occupancy",
                    bedding: "Bed Type",
                    roomDescLabel: "Notes (Optional)",
                    roomDescPlaceholder: "ex: View on the garden, built-in closet...",
                    decencyNotice: "Roomivo enforces French decency standards (min 9m² per occupant).",
                    amenities: "Room Amenities",
                    amenityPlaceholder: "Add amenity..."
                },
                pricing: {
                    title: "Rent & Charges",
                    monthlyRent: "Monthly Base Rent",
                    charges: "Monthly Charges",
                    chargesDesc: "Maintenance, water, etc.",
                    availableFrom: "Available From",
                    deposit: "Security Deposit",
                    ccFull: "Rent CC",
                    hcFull: "Rent HC",
                    ccDesc: "Charges Included",
                    hcDesc: "Excluding Charges",
                    typeLabel: "Rent Type",
                    chargesPlaceholder: "ex: 100",
                    depositLimit: "Max 1 month rent (Unfurnished) or 2 months (Furnished)",
                    depositWarning: "French law limits security deposit based on furnishing status.",
                    guarantor: {
                        title: "Guarantor Information",
                        typesLabel: "Accepted Guarantors",
                        elanNotice: "ELAN Law Compliant"
                    },
                    rentControl: {
                        title: "Rent Control",
                        desc: "This property is in a rent-controlled zone.",
                        link: "Check local regulations"
                    }
                },
                features: {
                    title: "Amenities & Surroundings",
                    amenities: "General Amenities",
                    customAmenities: "Custom Amenities",
                    addAmenity: "Add Amenity",
                    transport: "Nearby Transport",
                    landmarks: "Surroundings & Landmarks"
                },
                review: {
                    title: "Final Review"
                },
                media: {
                    readyToPublish: "Ready to Publish",
                    uploadAllToPublish: "Please upload photos for all rooms to publish.",
                    publishedTitle: "Listing Published!",
                    publishedDesc: "Your property is now live and receiving applications.",
                    viewBtn: "View Listing",
                    draftSaved: "Draft saved automatically",
                    roomsMissing: "Missing photos for {{count}} rooms",
                    roomProgress: "{{count}} photos uploaded",
                    noMedia: "No photos uploaded yet",
                    uploadDesc: "Take high-quality photos to attract more tenants",
                    qrInstructions: "Scan to upload from mobile",
                    checkStatus: "Check upload status",
                    filesUploaded: "{{count}} files uploaded",
                    fileCount: "{{count}} photos",
                    publishing: "Publishing...",
                    publishBtn: "Publish Listing",
                    backToProperties: "Back to Dashboard"
                },
                validation: {
                    required: "Please fill in all required fields",
                    enrichSuccess: "Location data enriched successfully!",
                    enrichFail: "Could not enrich location data automatically"
                },
                status: {
                    creating: "Creating your listing..."
                },
                btn: "Create Property"
            },
            type: {
                apartment: "Apartment",
                house: "House",
                studio: "Studio",
                room: "Room"
            },
            energy: {
                rating: {
                    A: "(Very efficient)",
                    B: "(Efficient)",
                    C: "(Moderate)",
                    D: "(Standard)",
                    E: "(Inefficient)",
                    F: "(High consumption)",
                    G: "(Very high consumption)"
                }
            },
            surface: {
                loi_carrez: "Loi Carrez",
                standard: "Standard"
            },
            pricing: {
                ccDesc: "Charges Included",
                ccFull: "Rent CC",
                chargesPlaceholder: "ex: 100",
                depositLimit: "Max 1 month rent (Unfurnished) or 2 months (Furnished)",
                depositWarning: "French law limits security deposits based on furnishing status.",
                guarantor: {
                    elanNotice: "ELAN Law compliant",
                    title: "Guarantor Information",
                    typesLabel: "Accepted Guarantors"
                },
                hcDesc: "Charges Excluded",
                hcFull: "Rent HC",
                maxLabel: "Maximum",
                rentControl: {
                    desc: "This property is in a rent control zone.",
                    link: "Check local regulations",
                    title: "Rent Control"
                },
                typeLabel: "Rent Type"
            },
            available: "Available",
            chargesIncluded: "CC",
            chargesExcluded: "HC",
            plusCharges: "+{{amount}}€ charges",
            size: "{{size}}m²",
            beds: "{{count}} beds",
            deposit: "Deposit",
            furnished: "Furnished",
            unfurnished: "Unfurnished",
            colocOk: "Coloc OK",
            guarantorReq: "Guarantor Req.",
            noGuarantor: "No Guarantor",
            loginToView: "Log in to View Details"
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
                "student_id": "Student ID / Enrollment Certificate",
                "internship_contract": "Internship Agreement",
                "scholarship": "Scholarship Notice",
                "caf": "Housing Aid Simulation (CAF/MSA)",
                "kbis": "Kbis Extract (less than 3 months)",
                "tax_return": "Latest Tax Return",
                "accounting": "Latest Accounting Balance",
                "benefits": "Social / Family Benefits",
                "pension": "Pension Proof",
                "payslip": "Last 3 Payslips",
                "contract": "Employment Contract / Certificate",
                "passport": "Passport",
                "id_card": "National ID Card",
                "residence_permit": "Residence Permit",
                "drivers_license": "Driver's License",
                "visale": "Visale Guarantee Certificate",
                "garantme": "Garantme Certificate",
                "bank_funds": "Blocked Bank Funds Certificate",
                "employer_cert": "Employer Certificate / Job Promise",
                "foreign_tax": "Foreign Tax Return"
        },
        search: {
            title: "Find your next home",
            filters: {
                location: "Location",
                locationPlaceholder: "Paris, Lyon, Bordeaux...",
                maxBudget: "Max Budget",
                furnished: "Furnished",
                colocation: "Colocation",
                searchButton: "Search"
            },
            status: {
                loading: "Loading properties...",
                error: "Impossible to load listings.",
                noResults: "No results found",
                noResultsDesc: "Try expanding your search criteria."
            },

        },
        disputes: {
            title: "Incident Reports",
            subtitle: "Track and manage your property disputes",
            desc: "Log property issues",
            report: "Report Incident",
            reportToast: "Select a lease from your dashboard to report an incident",
            noReports: "No reports found",
            noReportsDesc: "You haven't filed any incident reports yet. These reports help protect your deposit by creating a timestamped record of issues.",
            evidence: "Evidence",
            responseReceived: "Response received",
            platformRoleTitle: "Platform Role",
            platformRoleDesc: "Roomivo acts as a neutral facilitator to collect and preserve timestamped evidence. We do not adjudicate disputes or render binding verdicts. For legal assistance, we recommend contacting the Conciliateur de Justice or using the EU Online Dispute Resolution platform.",
            status: {
                open: "Open",
                awaiting_response: "Awaiting Response",
                under_review: "Under Review",
                closed: "Closed"
            },
            detail: {
                back: "Back",
                claimed: "claimed",
                description: "Description",
                reporterEvidence: "Reporter Evidence",
                addPhoto: "Add Photo",
                saveEvidence: "Save Evidence",
                accusedResponseTitle: "Accused Party Response",
                accusedResponsePrompt: "You have been named as the accused party. Use this section to provide your side of the story and any counter-evidence.",
                accusedResponsePlaceholder: "Explain what happened from your perspective...",
                submitResponse: "Submit My Response",
                submittedOn: "Submitted {{date}}",
                currentStatus: "Current Status",
                facilitationTitle: "Roomivo Facilitation",
                facilitationDesc: "Our admin team is monitoring this incident to ensure all evidence is collected correctly. We act as a neutral party to preserve the record.",
                recommendedAction: "Recommended Action",
                proceedMediation: "Proceed to Mediation",
                mediationPlatform: "Official EU Online Dispute Resolution Platform",
                legalDisclaimerTitle: "Legal Disclaimer",
                legalDisclaimerDesc: "Roomivo facilitates evidence collection and inventory comparison. The platform does not adjudicate disputes or render binding verdicts. Per Loi ALUR, landlords have 1-2 months post-lease to return deposits. Deductions for normal wear and tear are prohibited.",
                steps: {
                    open: { label: "Report Filed", desc: "Timestamped and preserved" },
                    awaiting_response: { label: "Other Party Notified", desc: "Awaiting counter-evidence" },
                    under_review: { label: "Facilitation", desc: "Admin reviewing both sides" },
                    closed: { label: "Closed", desc: "Process completed" }
                }
            },
            incident: {
                title: "Report an Incident",
                desc: "Provide details about the issue to notify your landlord and our facilitation team.",
                lease: "Select Lease",
                noLease: "You do not have any active leases to report an incident on.",
                selectLease: "Select your lease",
                category: "Category",
                selectCategory: "Select a category",
                categories: {
                    damage: "Property Damage",
                    appliance: "Appliance Failure",
                    cleaning: "Cleaning / Hygiene",
                    shared: "Shared Space Issue",
                    other: "Other"
                },
                titleLabel: "Issue Title",
                titlePlaceholder: "Brief description (e.g. Broken Heater)",
                description: "Detailed Description",
                descPlaceholder: "Explain what happened in detail...",
                evidence: "Visual Evidence (Photos/Videos)",
                uploading: "Uploading evidence...",
                submitting: "Submitting...",
                submitBtn: "Submit Incident Report",
                success: "Incident reported successfully",
                error: "Failed to report incident"
            },
            messages: {
                loadError: "Failed to load your disputes",
                loadDetailError: "Failed to load dispute details",
                addEvidenceSuccess: "Evidence added successfully",
                addEvidenceError: "Failed to add evidence",
                responseSuccess: "Response submitted",
                responseError: "Failed to submit response",
                uploading: "Uploading...",
                submitting: "Submitting..."
            }
        }
    },
    fr: {
        common: {
            save: "Enregistrer",
            cancel: "Annuler",
            delete: "Supprimer",
            edit: "Modifier",
            view: "Voir",
            manage: "Gérer",
            viewAll: "Voir tout",
            back: "Retour",
            next: "Suivant",
            submit: "Envoyer",
            loading: "Chargement...",
            requiredByLaw: "Obligatoire par la loi",
            actions: {
                profile: "Mon Profil",
                verification: "Vérification d'identité",
                documents: "Documents",
                help: "Aide",
                toComplete: "À compléter"
            },
            verification: {
                title: "Vérification du Profil",
                email: "Email",
                questionnaire: "Questionnaire",
                identity: "Identité",
                employment: "Emploi"
            },
            placeholders: {
                fullName: "Jean Dupont",
                bio: "Un peu sur vous...",
                email: "nom@entreprise.com",
                phone: "+33 6 12 34 56 78",
                password: "••••••••",
                newPassword: "Entrez le nouveau mot de passe",
                confirmPassword: "Confirmez le nouveau mot de passe",
                delete: "Tapez SUPPRIMER",
                address: "Commencez à taper une adresse en France…",
                addressLine2: "Appartement, suite, etc. (optionnel)",
                description: "Décrivez votre propriété...",
                kitchenSink: "ex: Évier de cuisine",
                school: "Entrez le nom de votre école/université",
                city: "Ville (ex: Paris, Lyon...)",
                guarantorName: "Nom complet du garant (Optionnel)",
                guarantorEmail: "garant@email.com",
                tenantEmail: "locataire@email.com",
                workplaceAddress: "Commencez à saisir l'adresse de votre lieu de travail...",
                year: "ex: 1985",
                charges: "Ex: Eau froide, entretien parties communes...",
                disputeObservations: "Saisissez des observations factuelles sur les preuves...",
                search: "Rechercher...",
                selectOption: "Sélectionnez une option...",
                selectUniversity: "Sélectionnez votre université...",
                url: "https://..."
            }
        },
        // Landing Page
        landing: {
            title: "Bienvenue sur Roomivo",
            subtitle: "Vérification d'identité, matching intelligent et baux numériques — tout ce dont vous avez besoin pour louer en toute sécurité en France.",
            getStarted: "Commencer",
            signIn: "Se connecter",
            hero: {
                title: "Trouvez votre foyer idéal en toute confiance",
                subtitle: "La plateforme tout-en-un pour des locations sécurisées en France."
            },
            howItWorks: {
                title: "Comment ça marche",
                subtitle: "Trois étapes simples pour trouver votre foyer idéal ou le locataire parfait.",
                steps: {
                    profile: { title: "Créez votre profil", desc: "Inscrivez-vous et vérifiez votre identité en quelques minutes." },
                    matching: { title: "Matching Intelligent", desc: "Notre algorithme suggère les meilleures correspondances selon vos critères." },
                    lease: { title: "Bail Numérique", desc: "Générez un contrat de bail conforme en quelques clics." }
                }
            },
            cta: {
                tenant: { title: "Vous cherchez un logement ?", desc: "Constituez votre dossier numérique et postulez en un clic.", button: "Je suis locataire" },
                landlord: { title: "Vous êtes propriétaire ?", desc: "Listez vos biens et recevez des candidatures vérifiées.", button: "Je suis propriétaire" }
            }
        },
        // Onboarding
        onboarding: {
            welcome: "Bienvenue sur Roomivo.",
            letsStart: "Commençons par votre nom",
            ready: "Prêt à trouver votre logement idéal ? Nous allons vous poser quelques questions rapides pour personnaliser votre expérience.",
            saving: "Enregistrement...",
            getStarted: "Commencer",
            skip: "Passer pour l'instant",
            pendingInvites: "Invitations en attente",
            teamInvite: "Invitation d'équipe",
            view: "Voir",
            title: "Bienvenue sur Roomivo",
            back: "Retour",
            continue: "Continuer",
            processing: "Traitement de vos réponses...",
            step: "Question {{current}} sur {{total}}",
            questions: {
                tenant: {
                    situation: {
                        question: "Quelle situation vous décrit le mieux ?",
                        options: {
                            student_budget: "🎓 Étudiant",
                            family_stability: "👨‍👩‍👧‍👦 Salarié / Famille",
                            flexibility_relocation: "💻 Freelance / Remote",
                            other: "❓ Autre"
                        }
                    },
                    workplace: {
                        question: "Où travaillez-vous ?"
                    },
                    location: {
                        question: "Où souhaitez-vous louer ?",
                        placeholder: "ex: Paris, Lyon, Marseille..."
                    },
                    budget: {
                        question: "Quel est votre budget mensuel ?"
                    },
                    lease_duration: {
                        question: "Combien de temps comptez-vous rester ?",
                        options: {
                            short_term: "Court terme (3-6 mois)",
                            medium_term: "Moyen terme (6-12 mois)",
                            long_term: "Long terme (1-2 ans)",
                            very_long_term: "Très long terme (2 ans+)"
                        }
                    },
                    move_in_timeline: {
                        question: "Quand devez-vous emménager ?",
                        options: {
                            asap: "Dès que possible (sous 1 semaine)",
                            soon: "Bientôt (sous 2-4 semaines)",
                            flexible: "Flexible (1-3 mois)",
                            browsing: "Je regarde juste pour le moment"
                        }
                    }
                },
                landlord: {
                    property_count: {
                        question: "Combien de biens possédez-vous ou gérez-vous ?",
                        options: {
                            "1_4": "1-4 biens",
                            "5_100": "5-100 biens",
                            "100_plus": "100+ biens"
                        }
                    },
                    challenge: {
                        question: "Quel est votre plus grand défi actuel ?",
                        options: {
                            finding_tenants: "Trouver des locataires fiables rapidement",
                            avoiding_fraud: "Éviter les mauvais payeurs / la fraude",
                            regulations: "Comprendre les réglementations locatives",
                            all: "Tout ce qui précède"
                        }
                    },
                    location: {
                        question: "Où sont situés vos biens ?",
                        placeholder: "ex: Paris, Lyon, Partout en France..."
                    },
                    urgency: {
                        question: "Quand devez-vous remplir votre prochaine vacance ?",
                        options: {
                            urgent: "Urgent (sous 2 semaines)",
                            soon: "Bientôt (sous 1 mois)",
                            planning: "Anticipation (1-3 mois)",
                            exploring: "J'explore juste pour le moment"
                        }
                    }
                }
            }
        },

        actionCenter: {
            allInOrder: "Tout est en ordre",
            noUrgentAction: "Aucune action urgente requise"
        },
        emailVerification: {
            loading: "Chargement...",
            title: "Vérifiez votre e-mail",
            sentMessage1: "Nous avons envoyé un lien de vérification à",
            sentMessage2: " Veuillez vérifier votre boîte de réception et cliquer sur le lien pour continuer.",
            success: "E-mail de vérification envoyé !",
            sending: "Envoi...",
            resendButton: "Renvoyer l'e-mail de vérification",
            alreadyVerified: "J'ai vérifié mon e-mail →",
            differentAccount: "Se connecter avec un autre compte",
            spamFolder: "Vous ne trouvez pas l'e-mail ? Vérifiez vos spams ou demandez-en un nouveau."
        },

        visitBooking: {
            title: "Planifier une visite",
            success: { booked: "Visite réservée avec succès !" },
            error: { bookingFailed: "Échec de la réservation. Le créneau est peut-être déjà pris." },
            confirmed: {
                title: "Visite confirmée !",
                desc: "Votre visite virtuelle est planifiée. Vous recevrez un e-mail de confirmation.",
                joinButton: "Rejoindre l'appel vidéo",
                secureLink: "Lien sécurisé via Jitsi Meet"
            },
            selectRoomDesc: "Quelle chambre souhaitez-vous visiter ?",
            slotsAvailable: "créneau{{count}} disponible",
            backToRooms: "Retour aux chambres",
            noSlots: "Aucune disponibilité répertoriée pour le moment.",
            bookingInProgress: "Réservation...",
            confirmButton: "Confirmer la visite",
            reserveInstantly: "Réservez ce créneau instantanément.",
            selectTimeSlot: "Sélectionnez un créneau horaire."
        },

        // Dashboard
        dashboard: {
            title: "Tableau de bord",
            welcome: "Bienvenue",
            welcome_desc: "Voici ce qui se passe pour vous aujourd'hui.",
            logout: "Se déconnecter",
            role: {
                landlord: "Mode Propriétaire",
                tenant: "Mode Locataire"
            },
            stats: {
                properties: "Propriétés",
                propertiesDesc: "Toutes vos annonces",
                activeListings: "Actif",
                activeDesc: "En ligne sur la plateforme",
                drafts: "Brouillons",
                draftsDesc: "En attente de publication",
                views: "Vues Totales",
                viewsDesc: "Depuis le début",
                trustScore: "Score de Confiance",
                complete: "Complétez vos vérifications pour booster votre score",
                verified: "Votre score de confiance est parfait !",
                improve: "Améliorer le score"
            },
            quickActions: {
                title: "Actions rapides",
                my_disputes: "Mes Litiges",
                property_disputes: "Litiges Immobiliers",
                disputes: "Litiges",
                applications: "Candidatures",
                messages: "Messages",
                search: "Rechercher",
                team: "Équipe",
                analytics: "Analyses",
                browse: { title: "Parcourir les Biens", desc: "Trouvez votre prochain foyer" },
                newProperty: { title: "Nouveau Bien", desc: "Listez un nouveau bien" },
                verify: { title: "Compléter la Vérification", desc: "Vérifiez votre identité" },
                messages: { title: "Messages", desc: "Voir la boîte de réception" },
                onboarding: { title: "Onboarding", desc: "Complétez votre profil" },
                team: { title: "Gestion d'Équipe", desc: "Gérer les collaborateurs" },
                analytics: { title: "Analyses", desc: "Performance du portefeuille" },
                gli: { title: "Garantie Loyers", desc: "Protégez vos revenus" }
            },
            verification: {
                email: "Vérification E-mail",
                identity: "Vérification d'Identité",
                employment: "Vérification d'Emploi",
                verified: "Vérifié",
                pending: "En attente",
                start: "Démarrer la vérification",
                progressLabel: "Progression de la vérification",
                resend: "Renvoyer l'e-mail",
                sending: "Envoi...",
                toast: {
                    success: "E-mail de vérification envoyé ! Consultez votre boîte de réception."
                },
                verification: {
                    title: "Statut de Vérification",
                    pageTitle: "Vérification",
                    backToDashboard: "Retour au tableau de bord",
                    progressLabel: "Progression des vérifications",
                    email: "Email",
                    identity: "Identité",
                    employment: "Emploi",
                    verified: "Vérifié",
                    pending: "En attente",
                    start: "Démarrer",
                    resend: "Renvoyer",
                    sending: "Envoi...",
                    tabs: {
                        identity: "Vérification d'Identité",
                        employment: "Vérification d'Emploi"
                    },
                    success: {
                        identity: "Identité Vérifiée !",
                        identityMsg: "Votre identité a été vérifiée avec succès.",
                        employment: "Vérification d'Emploi",
                        employmentMsg: "Votre emploi a été vérifié avec succès."
                    },
                    property_title: "Vérification de la propriété",
                    property_desc: "Veuillez télécharger une preuve de propriété (acte de vente ou taxe foncière)",
                    identity_desc: "Par sécurité, veuillez capturer des photos en direct de votre pièce d'identité officielle",
                    employment_desc: "Téléchargez vos documents professionnels ou financiers",
                    legalDisclaimerDesc: "Vos documents sont cryptés et stockés en toute sécurité. Nous utilisons les meilleures pratiques de sécurité pour protéger votre vie privée.",
                    progress: {
                        title: "Progression des vérifications",
                        email: "Email",
                        identity: "Identité",
                        employment: "Emploi",
                        trustScore: "Score de Confiance"
                    },
                    actions: {
                        back: "Retour au tableau de bord",
                        retake: "Reprendre les photos",
                        uploadSecurely: "Télécharger et vérifier en toute sécurité",
                        uploading: "Téléchargement et vérification...",
                        mobileWaiting: "En attente de la capture mobile...",
                        generatingSession: "Génération d'une session sécurisée...",
                        copy: "Copier",
                        howItWorks: "Comment ça marche :",
                        scanQr: "Scannez le code QR avec votre téléphone",
                        selectDoc: "Sélectionnez votre type de document",
                        takePhoto: "Prenez une photo claire du document",
                        autoUpdate: "Cette page se mettra à jour automatiquement"
                    }
                }
            },
            inbox: {
                title: "Boîte de réception",
                unread: "non lu(s)",
                viewAll: "Voir tout",
                empty: "Aucun message pour l'instant",
                emptyDesc: "Votre historique de conversation apparaîtra ici.",
                selectPrompt: "Sélectionnez une conversation",
                selectDesc: "Cliquez sur une conversation pour voir les messages",
                searchPlaceholder: "Rechercher...",
                filters: {
                    all: "Toutes",
                    active: "Actives",
                    archived: "Archivées"
                },
                status: {
                    noConversations: "Aucune conversation",
                    noConversationsDesc: "Vous n'avez pas encore de messages. Les demandes des locataires apparaîtront ici."
                },
                time: {
                    yesterday: "Hier"
                },
                tenant: {
                    activity: "Mon Activité",
                    applications: "Candidatures",
                    visits: "Visites prévues",
                    favorites: "Favoris",
                    activeDisputes: "Litiges en cours",
                    premiumTitle: "Services Premium",
                    premiumDesc: "Profitez de nos services de relocation pour votre mobilité professionnelle",
                    discover: "Découvrir",
                    recentSearches: "Recherches récentes",
                    noSearches: "Vous n'avez pas encore effectué de recherche.",
                    searchButton: "Rechercher un bien"
                },
                landlord: {
                    welcome: "Bienvenue, {{name}}",
                    title: "Tableau de bord Propriétaire",
                    gettingStarted: "Commencer",
                    gettingStartedDesc: "Ajoutez votre premier bien pour commencer à recevoir des candidatures",
                    addProperty: "Ajouter un bien",
                    portfolio: "Mon Patrimoine",
                    activeProperties: "Biens actifs",
                    applications: "Candidatures",
                    visits: "Visites prévues",
                    messages: "Messages",
                    activeDisputes: "Litiges en cours",
                    analytics: "Analyses",
                    viewsMonth: "Vues ce mois-ci",
                    occupancyRate: "Taux d'occupation",
                    revenue: "Revenu mensuel",
                    viewDetailed: "Voir les analyses détaillées",
                    myTeam: "Mon Équipe",
                    collaborate: "Collaborer efficacement",
                    collaborateDesc: "Invitez des collaborateurs pour gérer vos biens ensemble.",
                    inviteMember: "Inviter un membre",
                    recentMessages: "Messages récents",
                    noMessages: "Pas encore de nouveaux messages."
                },
                agency: {
                    enterpriseActions: "Actions Entreprise",
                    bulkImport: "Import en masse",
                    csvXml: "CSV / XML",
                    gliQuote: "Devis GLI",
                    rentGuarantee: "Assurance Loyers Impayés",
                    erpIntegration: "Intégration ERP",
                    webhooksApi: "API Webhooks",
                    team: "Équipe",
                    accessManagement: "Gestion des accès",
                    overview: "Vue d'ensemble",
                    activeMandates: "Mandats actifs",
                    leased: "Loués",
                    applications: "Candidatures",
                    webhooks: "Webhooks",
                    members: "Membres",
                    analytics: "Analyses",
                    export: "Exporter",
                    totalViews: "Vues totales",
                    conversionRate: "Taux de conversion",
                    avgRentalTime: "Temps moyen de location",
                    managedRevenue: "Revenu géré",
                    recentActivity: "Activité récente",
                    noActivity: "Aucune activité récente",
                    compliance: "Conformité & Vérifications",
                    kbisRegistration: "Enregistrement Kbis",
                    verifiedStatus: "Statut entreprise vérifié",
                    kbisRequired: "Extrait de moins de 3 mois requis",
                    uploadKbis: "Charger le Kbis",
                    carteG: "Carte G (Carte Professionnelle)",
                    verifiedLicense: "Licence de gestion immobilière vérifiée",
                    carteGRequired: "Requis pour la gestion immobilière en France",
                    uploadCarteG: "Charger la Carte G"
                }
            },
            
            globalFooter: {
                terms: "Conditions Générales",
                privacy: "Confidentialité & CNIL",
                cookies: "Politique des Cookies",
                gdpr: "Droits RGPD",
                help: "Centre d'Aide",
                rights: "Tous droits réservés."
            },

            landlord: {
                welcome: "Bienvenue, {{name}}",
                subtitle: "Espace Propriétaire",
                onboarding: {
                    title: "Pour commencer",
                    desc: "Ajoutez votre premier bien pour recevoir des candidatures",
                    button: "Ajouter un bien"
                },
                sections: {
                    quickActions: "Actions Rapides",
                    portfolio: "Mon Patrimoine",
                    visits: "Gestion des Visites",
                    gli: "Garantie Loyers Impayés (GLI)",
                    analytics: "Analyses",
                    team: "Mon Équipe",
                    inbox: "Messages Récents"
                },
                widgets: {
                    visits: {
                        title: "Disponibilités des Visites",
                        desc: "Définissez vos créneaux pour permettre aux locataires de réserver.",
                        date: "Date",
                        startTime: "Heure de début",
                        add: "Ajouter un créneau",
                        available: "Créneaux Disponibles",
                        noSlots: "Aucun créneau défini.",
                        booked: "Réservé"
                    },
                    gli: {
                        button: "️ Devis GLI",
                        title: "Garantie Loyers Impayés",
                        subtitle: "Protection contre les impayés",
                        rent: "Loyer Mensuel",
                        income: "Revenus Mensuels Locataire",
                        ratio: "Ratio : {{ratio}}x le loyer",
                        min_ratio: "(min 3x)",
                        contract: "Type de Contrat",
                        verified_job: "Emploi Vérifié",
                        verified_id: "Identité Vérifiée",
                        calculate: "Calculer le Devis",
                        calculating: "Calcul en cours...",
                        eligible: "Éligible à la GLI",
                        ineligible: "Non Éligible",
                        premium_monthly: "Prime Mensuelle",
                        premium_annual: "Prime Annuelle",
                        subscribe: "Souscrire maintenant",
                        success: "Demande soumise ! Un conseiller vous contactera sous 24h."
                    }
                }
            }
        },
        analytics: {
            subtitle: "Suivez la performance de votre portefeuille et votre croissance financière.",
            totalViews: "Vues Totales",
            occupancy: "Taux d'Occupation",
            potentialRevenue: "Revenu Potentiel",
            activeListings: "Annonces Actives",
            viewsOverTime: "Vues au Fil du Temps",
            demographics: "Démographie des Locataires",
            chartNotice: "Des graphiques interactifs sont en cours de génération. Revenez dans quelques heures.",
            demoNotice: "Comprenez qui consulte vos annonces pour optimiser votre marketing.",
            periods: {
                d7: "7J",
                d30: "30J",
                d90: "90J",
                y1: "1A"
            }
        },
        gli: {
            subtitle: "Protégez vos revenus locatifs contre les impayés et les dégradations.",
            selectProperty: "Sélectionnez un Bien"
        },
        facilitation: {
            title: "Panneau de Facilitation",
            subtitle: "Préservez les preuves et redirigez les parties vers la médiation officielle.",
            neutralNotice: "Roomivo est un facilitateur neutre. Pas de verdicts.",
            allClear: "Tout est en ordre",
            noDisputes: "Aucun litige actif à faciliter.",
            reviewDetails: "Examiner les détails",
            backToList: "Retour à la liste",
            evidence: "Preuves",
            inventoryDiff: "Diff d'Inventaire",
            lateFiling: "Dépôt tardif",
            reporter: "Déclarant",
            accused: "Mis en cause",
            reporterEvidence: "Preuves du déclarant",
            counterResponse: "Contre-réponse",
            noResponse: "Aucune réponse soumise pour le moment.",
            conditionComparison: "Comparaison de l'état",
            item: "Élément",
            before: "Avant",
            after: "Après",
            status: "Statut",
            observations: "Observations (Internes/Neutres)",
            updateStatus: "Mettre à jour le statut",
            mediationLink: "Lien de médiation (Redirection)",
            updateObservations: "Mettre à jour les observations",
            finalizeClose: "Finaliser & Fermer",
            geoVerification: "Géo-Vérification",
            distanceFromProperty: "{{distance}}m du bien",
            alurCheck: "Vérification Loi ALUR",
            alurNotice: "Les retenues pour usure normale sont interdites. Les propriétaires ont 2 mois maximum pour restituer le dépôt en cas de divergences.",
            filters: {
                all: "Tous",
                open: "Ouverts",
                awaiting: "En attente",
                review: "En révision",
                closed: "Clôturés"
            },
            categories: {
                damage: "Dégradation",
                unpaid_rent: "Loyer Impayé",
                other: "Autre"
            },
            moveIn: "ENTRÉE",
            moveOut: "SORTIE",
            distance: "Distance",
            verified: "Vérifié",
            unverified: "Non Vérifié"
        },
        guide: {
            back: "Retour",
            resourceCenter: "Centre de Ressources",
            title: "Guides & Conseils",
            subtitle: "Découvrez nos articles pour vous aider dans votre projet immobilier.",
            tenant: {
                title: "Guide du Locataire",
                description: "Comprendre le dossier, les garants et le bail."
            },
            landlord: {
                title: "Guide des Prix (Propriétaire)",
                description: "Tendances du marché et estimation du loyer."
            }
        },
        auth: {
            login: {
                title: "Bon retour parmi nous",
                subtitle: "Accédez à votre compte",
                email: "Adresse e-mail",
                password: "Mot de passe",
                forgotPassword: "Mot de passe oublié ?",
                forgotEmail: "E-mail oublié ?",
                submit: "Se connecter en toute sécurité",
                loading: "Connexion...",
                signingIn: "Connexion en cours...",
                noAccount: "Vous n'avez pas de compte ?",
                signUp: "Créez-en un maintenant",
                createAccount: "Créer un compte",
                connectingGoogle: "Connexion à Google...",
                divider: "ou connectez-vous par e-mail",
                signIn: "Se connecter en toute sécurité",
                error: {
                    google: "La connexion Google n'a pas retourné de justificatif. Veuillez réessayer.",
                    googleFail: "La connexion Google a échoué. Veuillez réessayer.",
                    googleScript: "Impossible de charger la connexion Google. Veuillez utiliser la connexion par e-mail.",
                    loginFail: "Échec de la connexion. Veuillez réessayer."
                }
            },
            register: {
                title: "Créez votre compte",
                subtitle: "Rejoignez la plateforme",
                hasAccount: "Vous avez déjà un compte ?",
                signIn: "Connectez-vous",
                fullName: "Nom complet",
                phone: "Numéro de téléphone",
                optional: "(optionnel)",
                phoneDesc: "Utilisé pour récupérer votre compte si vous oubliez votre e-mail",
                email: "Adresse e-mail",
                password: "Mot de passe",
                confirmPassword: "Confirmer le mot de passe",
                passwordHint: "Au moins 8 caractères",
                passwordStrength: {
                    secure: "Mot de passe sécurisé ",
                    criteria: "/5 critères"
                },
                match: {
                    error: "Les mots de passe ne correspondent pas",
                    success: " Correspondance"
                },
                accept: "J'accepte la",
                privacy: "Politique de confidentialité",
                and: "et les",
                terms: "Conditions d'utilisation",
                consent: {
                    gdpr: "J'accepte la Politique de Confidentialité et les CGU",
                    error: "Vous devez accepter la Politique de Confidentialité",
                    marketing: "Recevoir les offres et actualités (optionnel)"
                },
                signingUp: "Création du compte...",
                signUp: "Créer un compte",
                submit: "Créer mon compte",
                loading: "Création...",
                connectingGoogle: "Création du compte avec Google...",
                divider: "ou créez-en un par e-mail",
                role: {
                    label: "Je suis un",
                    question: "Je suis un",
                    tenant: "Locataire",
                    tenantDesc: "Je cherche un logement",
                    landlord: "Propriétaire",
                    landlordDesc: "Je loue un bien",
                    manager: "Gestionnaire",
                    managerDesc: "Je gère des biens"
                },
                error: {
                    privacy: "Vous devez accepter la politique de confidentialité pour créer un compte",
                    mismatch: "Les mots de passe ne correspondent pas",
                    security: "Le mot de passe ne répond pas aux exigences de sécurité",
                    fail: "L'inscription a échoué. Veuillez réessayer."
                }
            }
        },
        profile: {
            title: "Mon Profil",
            back: "Retour",
            accountSettings: "Paramètres du Compte",
            notifications: "Notifications",
            privacy: "Confidentialité (RGPD)",
            logout: "Déconnexion"
        },
        property: {
            create: {
                title: "Ajouter un Nouveau Bien",
                subtitle: "Configurez votre annonce en quelques étapes simples.",
                back: "Retour aux biens",
                steps: {
                    basic: "Informations de Base",
                    location: "Localisation",
                    details: "Détails du Bien",
                    layout: "Configuration des Pièces",
                    pricing: "Loyer & Conditions",
                    features: "Équipements & Atouts",
                    review: "Récapitulatif"
                },
                basic: {
                    title: "Informations de Base",
                    propertyTitle: "Titre de l'Annonce",
                    propertyTitlePlaceholder: "ex: Charmant T2 au centre de Paris",
                    propertyType: "Type de Bien",
                    description: "Description du Bien",
                    descriptionPlaceholder: "Décrivez les points forts de votre bien...",
                    type: "Type"
                },
                location: {
                    title: "Localisation du Bien",
                    address: "Adresse",
                    addressPlaceholder: "Commencez à taper votre adresse...",
                    addressLine2: "Bâtiment, Étage, Appartement",
                    addressLine2Placeholder: "Optionnel",
                    city: "Ville",
                    postalCode: "Code Postal",
                    autoDetect: "Détection Automatique",
                    autoDetectDesc: "Utilisez l'IA pour détecter les transports et points d'intérêt à proximité de votre adresse.",
                    autoDetectBtn: "Détecter les Environs",
                    detecting: "Détection...",
                    found: "{{count}} transports trouvés",
                    foundLandmarks: "{{count}} points d'intérêt trouvés"
                },
                details: {
                    title: "Détails du Bien",
                    bedrooms: "Chambres",
                    bathrooms: "Salles de bain",
                    size: "Surface habitable (m²)",
                    floor: "Étage",
                    furnished: "Logement Meublé",
                    energyRatingTitle: "Performance Énergétique (DPE)",
                    energyRatingDesc: "La loi française impose d'afficher l'étiquette énergie sur toutes les annonces.",
                    dpeLabel: "Classe Énergie (DPE)",
                    gesLabel: "Émission GES",
                    dpePlaceholder: "Sélectionnez une note",
                    surfaceType: "Type de mesure de surface",
                    loiCarrezDesc: "Mesure officielle obligatoire pour les copropriétés.",
                    constructionYear: "Année de construction"
                },
                layout: {
                    title: "Configuration & Capacité",
                    globalTitle: "Informations Générales",
                    capacity: "Capacité totale",
                    pieces: "Nombre de pièces",
                    livingRoom: "Surface séjour (m²)",
                    kitchen: "Type de cuisine",
                    commonAreas: "Parties communes",
                    bedroomTitle: "Chambre {{number}}",
                    bedroomDetails: "Literie & Surface",
                    bedroomDesc: "Description de la chambre",
                    surface: "Surface (m²)",
                    roomCapacity: "Capacité",
                    bedding: "Type de lit",
                    roomDescLabel: "Notes (Optionnel)",
                    roomDescPlaceholder: "ex: Vue sur jardin, placard intégré...",
                    decencyNotice: "Roomivo applique les critères de décence français (min 9m² par occupant).",
                    amenities: "Équipements de la pièce",
                    amenityPlaceholder: "Ajouter un équipement..."
                },
                pricing: {
                    title: "Loyer & Charges",
                    monthlyRent: "Loyer de base mensuel",
                    charges: "Charges mensuelles",
                    chargesDesc: "Entretien, eau, etc.",
                    availableFrom: "Disponible à partir du",
                    deposit: "Dépôt de garantie"
                },
                features: {
                    title: "Équipements & Environs",
                    amenities: "Équipements généraux",
                    customAmenities: "Équipements personnalisés",
                    addAmenity: "Ajouter un équipement",
                    transport: "Transports à proximité",
                    landmarks: "Environnement & Points d'intérêt"
                },
                review: {
                    title: "Récapitulatif"
                },
                media: {
                    readyToPublish: "Prêt à Publier",
                    uploadAllToPublish: "Veuillez charger des photos pour toutes les pièces pour publier.",
                    publishedTitle: "Annonce Publiée !",
                    publishedDesc: "Votre bien est maintenant en ligne et peut recevoir des candidatures.",
                    viewBtn: "Voir l'Annonce",
                    draftSaved: "Brouillon enregistré automatiquement",
                    roomsMissing: "Photos manquantes pour {{count}} pièces",
                    roomProgress: "{{count}} photos chargées",
                    noMedia: "Aucune photo chargée",
                    uploadDesc: "Prenez des photos de haute qualité pour attirer plus de locataires",
                    qrInstructions: "Scannez pour charger depuis mobile",
                    checkStatus: "Vérifier le statut",
                    filesUploaded: "{{count}} fichiers chargés",
                    fileCount: "{{count}} photos",
                    publishing: "Publication...",
                    publishBtn: "Publier l'Annonce",
                    backToProperties: "Retour au Tableau de bord"
                },
                validation: {
                    required: "Veuillez remplir tous les champs obligatoires",
                    enrichSuccess: "Données de localisation enrichies !",
                    enrichFail: "Échec de l'enrichissement automatique"
                },
                status: {
                    creating: "Création de votre annonce..."
                },
                btn: "Créer le Bien"
            },
            type: {
                apartment: "Appartement",
                house: "Maison",
                studio: "Studio",
                room: "Chambre"
            },
            energy: {
                rating: {
                    A: "(Très performant)",
                    B: "(Performant)",
                    C: "(Modéré)",
                    D: "(Standard)",
                    E: "(Peu performant)",
                    F: "(Consommation élevée)",
                    G: "(Consommation très élevée)"
                }
            },
            surface: {
                loi_carrez: "Loi Carrez",
                standard: "Standard"
            },
            pricing: {
                ccDesc: "Charges Comprises",
                ccFull: "Loyer CC",
                chargesPlaceholder: "ex: 100",
                depositLimit: "Max 1 mois de loyer (Non-meublé) ou 2 mois (Meublé)",
                depositWarning: "La loi française limite le dépôt de garantie selon l'ameublement.",
                guarantor: {
                    elanNotice: "Conforme à la Loi ELAN",
                    title: "Informations Garant",
                    typesLabel: "Garants Acceptés"
                },
                hcDesc: "Hors Charges",
                hcFull: "Loyer HC",
                maxLabel: "Maximum",
                rentControl: {
                    desc: "Ce bien est situé en zone d'encadrement des loyers.",
                    link: "Vérifier la réglementation locale",
                    title: "Encadrement des Loyers"
                },
                typeLabel: "Type de Loyer"
            },
            available: "Disponible",
            chargesIncluded: "CC",
            chargesExcluded: "HC",
            plusCharges: "+{{amount}}€ charges",
            size: "{{size}}m²",
            beds: "{{count}} lits",
            deposit: "Dépôt",
            furnished: "Meublé",
            unfurnished: "Non-meublé",
            colocOk: "Coloc OK",
            guarantorReq: "Garant requis",
            noGuarantor: "Sans garant",
            loginToView: "Connectez-vous pour voir les détails"
        },
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
                "student_id": "Carte étudiante / Certificat de scolarité",
                "internship_contract": "Convention de stage",
                "scholarship": "Avis de bourse",
                "caf": "Simulation d'aide au logement (CAF/MSA)",
                "kbis": "Extrait Kbis (moins de 3 mois)",
                "tax_return": "Dernier avis d'imposition",
                "accounting": "Dernier bilan comptable",
                "benefits": "Prestations sociales / familiales",
                "pension": "Justificatif de retraite",
                "payslip": "3 derniers bulletins de paie",
                "contract": "Contrat de travail / Attestation employeur",
                "passport": "Passeport",
                "id_card": "Carte nationale d'identité",
                "residence_permit": "Titre de séjour",
                "drivers_license": "Permis de conduire",
                "visale": "Certificat de garantie Visale",
                "garantme": "Certificat Garantme",
                "bank_funds": "Certificat de blocage de fonds bancaires",
                "employer_cert": "Attestation employeur / Promesse d'embauche",
                "foreign_tax": "Avis d'imposition étranger"
        },
        search: {
            title: "Trouvez votre futur chez-vous",
            filters: {
                location: "Localisation",
                locationPlaceholder: "Paris, Lyon, Bordeaux...",
                maxBudget: "Budget Max",
                furnished: "Meublé",
                colocation: "Colocation",
                searchButton: "Rechercher"
            },
            status: {
                loading: "Chargement des annonces...",
                error: "Impossible de charger les annonces.",
                noResults: "Aucun résultat trouvé",
                noResultsDesc: "Essayez d'élargir vos critères de recherche."
            }
        },
        disputes: {
            title: "Signalements d'incidents",
            subtitle: "Suivez et gérez vos litiges immobiliers",
            desc: "Signalez les problèmes du logement",
            report: "Signaler un incident",
            reportToast: "Sélectionnez un bail depuis votre tableau de bord pour signaler un incident",
            noReports: "Aucun signalement trouvé",
            noReportsDesc: "Vous n'avez pas encore soumis de signalement d'incident. Ces rapports aident à protéger votre dépôt de garantie en créant un historique horodaté.",
            evidence: "Preuve",
            responseReceived: "Réponse reçue",
            platformRoleTitle: "Rôle de la plateforme",
            platformRoleDesc: "Roomivo agit comme un facilitateur neutre pour collecter et préserver des preuves horodatées. Nous ne rendons pas de décisions ou de verdicts contraignants. Pour une assistance juridique, nous vous recommandons de contacter le Conciliateur de Justice ou d'utiliser la plateforme de Règlement en ligne des litiges de l'UE.",
            status: {
                open: "Ouvert",
                awaiting_response: "En attente de réponse",
                under_review: "En cours de révision",
                closed: "Clôturé"
            },
            detail: {
                back: "Retour",
                claimed: "réclamé",
                description: "Description",
                reporterEvidence: "Preuves du déclarant",
                addPhoto: "Ajouter une photo",
                saveEvidence: "Enregistrer les preuves",
                accusedResponseTitle: "Réponse de la partie mise en cause",
                accusedResponsePrompt: "Vous avez été désigné comme partie mise en cause. Utilisez cette section pour donner votre version des faits et fournir des contre-preuves.",
                accusedResponsePlaceholder: "Expliquez ce qui s'est passé de votre point de vue...",
                submitResponse: "Envoyer ma réponse",
                submittedOn: "Soumis le {{date}}",
                currentStatus: "Statut actuel",
                facilitationTitle: "Facilitation Roomivo",
                facilitationDesc: "Notre équipe administrative surveille cet incident pour s'assurer que toutes les preuves sont collectées correctement. Nous agissons en tant que partie neutre.",
                recommendedAction: "Action recommandée",
                proceedMediation: "Passer à la médiation",
                mediationPlatform: "Plateforme officielle de l'UE pour le règlement des litiges",
                legalDisclaimerTitle: "Mentions légales",
                legalDisclaimerDesc: "Roomivo facilite la collecte de preuves et la comparaison des états des lieux. La plateforme ne rend pas de verdicts. Selon la Loi ALUR, les propriétaires ont 1 à 2 mois après le bail pour restituer les dépôts. Les retenues pour usure normale sont interdites.",
                steps: {
                    open: { label: "Signalement déposé", desc: "Horodaté et préservé" },
                    awaiting_response: { label: "Partie adverse notifiée", desc: "En attente de contre-preuves" },
                    under_review: { label: "Facilitation", desc: "Révision des deux parties" },
                    closed: { label: "Clôturé", desc: "Processus terminé" }
                }
            },
            incident: {
                title: "Signaler un incident",
                desc: "Fournissez des détails sur le problème pour informer votre propriétaire et notre équipe de facilitation.",
                lease: "Sélectionner le Bail",
                noLease: "Vous n'avez pas de bail actif sur lequel signaler un incident.",
                selectLease: "Sélectionnez votre bail",
                category: "Catégorie",
                selectCategory: "Sélectionnez une catégorie",
                categories: {
                    damage: "Dommage Immobilier",
                    appliance: "Panne d'Équipement",
                    cleaning: "Nettoyage / Hygiène",
                    shared: "Problème de Parties Communes",
                    other: "Autre"
                },
                titleLabel: "Titre du problème",
                titlePlaceholder: "Brève description (ex: Chauffage en panne)",
                description: "Description détaillée",
                descPlaceholder: "Expliquez ce qui s'est passé en détail...",
                evidence: "Preuve Visuelle (Photos/Vidéos)",
                uploading: "Chargement des preuves...",
                submitting: "Envoi...",
                submitBtn: "Soumettre le rapport d'incident",
                success: "Incident signalé avec succès",
                error: "Échec du signalement de l'incident"
            },
            messages: {
                loadError: "Échec du chargement de vos litiges",
                loadDetailError: "Échec du chargement des détails du litige",
                addEvidenceSuccess: "Preuve ajoutée avec succès",
                addEvidenceError: "Échec de l'ajout de preuve",
                responseSuccess: "Réponse envoyée",
                responseError: "Échec de l'envoi de la réponse",
                uploading: "Téléchargement...",
                submitting: "Envoi..."
            }
        }
    }
};
