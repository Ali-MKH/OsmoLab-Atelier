import test from 'node:test';
import assert from 'node:assert/strict';
import { t, getDir, computeUniformIsoscelesTrapezoids } from './i18n';

test('i18n returns English translation by default and for en language', () => {
  assert.equal(t('dashboard', 'en'), 'Dashboard');
  assert.equal(t('olfactoryPyramid', 'en'), 'Olfactory Pyramid');
  assert.equal(t('tierTop', 'en'), 'Top Notes');
});

test('i18n returns Persian translation for fa language while keeping technical terms intact', () => {
  assert.equal(t('dashboard', 'fa'), 'داشبورد');
  assert.equal(t('olfactoryPyramid', 'fa'), 'هرم بویایی و پل‌ها');
  assert.equal(t('tierTop', 'fa'), 'نت‌های آغازین (Top Notes)');
  assert.equal(t('tierTopHeart', 'fa'), 'پل آغازین به میانی (Top-to-Heart Bridge)');
  assert.equal(t('tierHeartBase', 'fa'), 'پل میانی به پایه (Heart-to-Base Bridge)');
});

test('getDir correctly identifies RTL for fa and LTR for en', () => {
  assert.equal(getDir('fa'), 'rtl');
  assert.equal(getDir('en'), 'ltr');
});

test('pyramid influence percentage, help, and about keys are localized', () => {
  assert.equal(t('influenceLabel', 'en'), 'Influence');
  assert.equal(t('influenceLabel', 'fa'), 'سهم تأثیر');
  assert.equal(t('emptyTierPrompt', 'en'), 'Empty Tier — Click to Add Material');
  assert.equal(t('exportToPng', 'en'), 'Export to PNG');
  assert.equal(t('helpAndTutorial', 'en'), 'Help & Tutorial');
  assert.equal(t('aboutAndPrivacy', 'en'), 'About & Privacy');
});

test('computeUniformIsoscelesTrapezoids produces 5 symmetrical 4-vertex isosceles trapezoids with uniform side angles', () => {
  const tiers = computeUniformIsoscelesTrapezoids(200, 10, 24, 36, 4, 0.65);
  assert.equal(tiers.length, 5);

  tiers.forEach((tier, idx) => {
    // Every tier (including Top Notes) must have 4 vertices (isosceles trapezoid)
    const vertices = tier.points.split(' ');
    assert.equal(vertices.length, 4, `Tier ${tier.id} must have 4 vertices`);

    // Left and right leg slopes must be symmetrical and equal to 0.65 across all tiers
    assert.equal(tier.leftSlope, 0.65);
    assert.equal(tier.rightSlope, 0.65);

    // Symmetry around centerX = 200
    assert.equal((tier.topLeftX + tier.topRightX) / 2, 200);
    assert.equal((tier.botLeftX + tier.botRightX) / 2, 200);

    // Progressive widening from Top to Base
    assert.ok(tier.botHalfW > tier.topHalfW);
    if (idx > 0) {
      assert.ok(tier.topY > tiers[idx - 1].botY);
      assert.ok(tier.topHalfW > tiers[idx - 1].botHalfW);
    }
  });
});



