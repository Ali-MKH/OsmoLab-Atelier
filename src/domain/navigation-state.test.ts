import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidNavSection,
  parseNavFromHash,
  formatHashForNav,
  resolveInitialNavSection,
  normalizeMaterialSynonyms,
} from './navigation-state';

test('parseNavFromHash parses valid hashes and rejects invalid ones', () => {
  assert.equal(parseNavFromHash('#formula-lab'), 'formula-lab');
  assert.equal(parseNavFromHash('#/raw-materials'), 'raw-materials');
  assert.equal(parseNavFromHash('#OLFACTORY-WHEEL?foo=1'), 'olfactory-wheel');
  assert.equal(parseNavFromHash(''), null);
  assert.equal(parseNavFromHash('#unknown-section'), null);
});

test('resolveInitialNavSection prioritizes hash, then stored nav, then dashboard', () => {
  assert.equal(resolveInitialNavSection('#accords', 'formula-lab'), 'accords');
  assert.equal(resolveInitialNavSection('', 'scent-hierarchy'), 'scent-hierarchy');
  assert.equal(resolveInitialNavSection('#invalid', 'evaluations'), 'evaluations');
  assert.equal(resolveInitialNavSection('', 'invalid-tab'), 'dashboard');
  assert.equal(resolveInitialNavSection('', null), 'dashboard');
});

test('formatHashForNav and isValidNavSection validate all workspace sections', () => {
  assert.equal(isValidNavSection('mentor'), true);
  assert.equal(isValidNavSection('scent-memory'), true);
  assert.equal(isValidNavSection('inventory'), false);
  assert.equal(isValidNavSection('production'), false);
  assert.equal(isValidNavSection('nonexistent'), false);
  assert.equal(formatHashForNav('formula-lab'), '#formula-lab');
});

test('normalizeMaterialSynonyms handles arrays, comma strings, and fallbacks safely', () => {
  assert.deepEqual(
    normalizeMaterialSynonyms(['Methyl dihydrojasmonate', 'Paradisone'], 'Hedione'),
    ['Methyl dihydrojasmonate', 'Paradisone']
  );
  assert.deepEqual(
    normalizeMaterialSynonyms('Sylvamber, Orbitone', 'Iso E Super'),
    ['Sylvamber', 'Orbitone']
  );
  assert.deepEqual(
    normalizeMaterialSynonyms(undefined, 'Bergamot FCF, Bergamote'),
    ['Bergamot FCF', 'Bergamote']
  );
  assert.deepEqual(normalizeMaterialSynonyms(null, ''), []);
});
