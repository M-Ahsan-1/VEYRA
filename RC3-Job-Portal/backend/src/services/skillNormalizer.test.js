const { normalizeSkill, normalizeSkillList } = require('./skillNormalizer');

describe('skill normalization', () => {
  test.each([
    ['JS', 'JavaScript'],
    ['ReactJS', 'React'],
    ['Node', 'Node.js'],
    ['postgres', 'PostgreSQL'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeSkill(input)).toBe(expected);
  });

  test('merges aliases and keeps the higher importance', () => {
    expect(normalizeSkillList([
      { name: 'JS', importance: 2 },
      { name: 'JavaScript', importance: 5 },
    ])).toEqual([{ name: 'JavaScript', importance: 5 }]);
  });
});