import { test, expect } from '@playwright/test';
import { getAgencyQuestions, getLandlordQuestions, getTenantQuestions } from '../components/onboarding/onboardingQuestions';

/**
 * Nationality, sex and family situation are protected grounds (Code pénal 225-1,
 * loi 89-462 art. 1). Onboarding no longer asks a tenant for them, and no landlord
 * question offers them as a criterion. The API refuses them too
 * (backend/tests_integration/test_landlord_criticals.py).
 */

test.describe('protected grounds', () => {
    test('no onboarding question asks for nationality or gender', () => {
        const ids = [...getTenantQuestions(), ...getLandlordQuestions(), ...getAgencyQuestions()].map((q) => q.id);
        expect(ids).not.toContain('nationality');
        expect(ids).not.toContain('nationality_preference');
        expect(ids).not.toContain('gender');
    });

    test('a landlord cannot pick families as a tenant type', () => {
        const tenantTypes = getLandlordQuestions().find((q) => q.id === 'accepted_tenant_types');
        expect(tenantTypes, 'the question exists').toBeTruthy();
        expect((tenantTypes!.options ?? []).map((o) => o.value)).toEqual(['student', 'employee', 'freelancer']);
    });
});
