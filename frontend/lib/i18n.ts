export type Language = 'en';

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
                        button: "🛡️ Get GLI Quote",
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
                    secure: "Secure password ✓",
                    criteria: "/5 criteria"
                },
                match: {
                    error: "Passwords do not match",
                    success: "✓ Match"
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
        }
    }
};
