"""Questions about who may rent are caught; questions about the home are not."""

import pytest

from app.services.question_screen import asks_who_may_rent


@pytest.mark.parametrize("question", [
    "Do you accept foreigners?",
    "Do you accept international students?",
    "Would you rent to a couple?",
    "Is it ok for a family with kids?",
    "Do you take students on a visa?",
    "Are you open to Muslim tenants?",
    "Do you accept wheelchair users?",
    "Girls only?",
    "Is it for women only?",
    "Acceptez-vous les étrangers ?",
    "Vous acceptez les etudiants etrangers ?",
    "Louez-vous à une famille avec enfants ?",
    "C'est réservé aux filles ?",
    "Acceptez-vous un titre de séjour étudiant ?",
    "Ouvert aux personnes handicapées ?",
])
def test_who_may_rent_questions_are_caught(question):
    assert asks_who_may_rent(question), question


@pytest.mark.parametrize("question", [
    "Is there a dishwasher?",
    "Is the flat wheelchair accessible?",
    "Is there a lift? I use a wheelchair.",
    "Can you give me an accommodation certificate for my visa?",
    "Do you accept pets?",
    "Is the neighbourhood family friendly and quiet?",
    "How many flatmates are there?",
    "Is internet included in the rent?",
    "Y a-t-il un lave-vaisselle ?",
    "Acceptez-vous les animaux ?",
    "Le logement est-il accessible en fauteuil roulant ?",
    "Pouvez-vous me fournir une attestation d'hébergement pour mon visa ?",
    "",
])
def test_questions_about_the_home_pass(question):
    assert not asks_who_may_rent(question), question
