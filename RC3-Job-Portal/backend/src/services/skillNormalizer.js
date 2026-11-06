const ALIASES = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  'java script': 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  py: 'Python',
  python3: 'Python',
  python: 'Python',
  node: 'Node.js',
  nodejs: 'Node.js',
  'node.js': 'Node.js',
  'express.js': 'Express',
  expressjs: 'Express',
  react: 'React',
  'react.js': 'React',
  reactjs: 'React',
  'next.js': 'Next.js',
  nextjs: 'Next.js',
  django: 'Django',
  flask: 'Flask',
  fastapi: 'FastAPI',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  psql: 'PostgreSQL',
  mongo: 'MongoDB',
  mongodb: 'MongoDB',
  mysql: 'MySQL',
  docker: 'Docker',
  k8s: 'Kubernetes',
  kubernetes: 'Kubernetes',
  aws: 'AWS',
  'amazon web services': 'AWS',
  gcp: 'Google Cloud',
  'google cloud platform': 'Google Cloud',
  'rest api': 'REST APIs',
  'rest apis': 'REST APIs',
  restful: 'REST APIs',
  'restful api': 'REST APIs',
  'restful apis': 'REST APIs',
  git: 'Git',
  github: 'GitHub',
  ci: 'CI/CD',
  'ci/cd': 'CI/CD',
  ml: 'Machine Learning',
  'machine learning': 'Machine Learning',
  html5: 'HTML',
  html: 'HTML',
  css3: 'CSS',
  css: 'CSS',
  sql: 'SQL',
  redis: 'Redis',
  graphql: 'GraphQL',
};

const clean = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');

function normalizeSkill(name) {
  const trimmed = String(name).trim().replace(/\s+/g, ' ');
  return ALIASES[clean(trimmed)] || trimmed;
}

// Normalizes names and merges duplicates, keeping the highest importance.
function normalizeSkillList(skills = []) {
  const merged = new Map();
  for (const skill of skills) {
    const name = normalizeSkill(skill.name);
    const key = name.toLowerCase();
    const existing = merged.get(key);
    if (!existing || (skill.importance ?? 3) > (existing.importance ?? 3)) {
      merged.set(key, { ...skill, name });
    }
  }
  return [...merged.values()];
}

module.exports = { normalizeSkill, normalizeSkillList, ALIASES };