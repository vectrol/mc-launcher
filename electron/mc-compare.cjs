// PCL-style version comparison — see ModMinecraft.vb:2431-2483
const LABEL_WEIGHTS = {
  'rc': -1, 'pre': -2, 'snapshot': -3, 'experimental': -4,
  'alpha': -5, 'beta': -6, '快照': -3, '预览版': -2,
};

function tokenize(ver) {
  return [...ver.toLowerCase().matchAll(/[a-z]+|[0-9]+/g)].map(m => m[0]);
}

function val(s) { const n = Number(s); return Number.isNaN(n) ? 0 : n; }

function compareVersion(left, right) {
  const UNKNOWN = '未知版本';
  if (left === UNKNOWN) return right !== UNKNOWN ? 1 : 0;
  if (right === UNKNOWN) return -1;

  const la = tokenize(left), ra = tokenize(right);
  for (let i = 0; ; i++) {
    if (i >= la.length && i >= ra.length) return 0;

    let lv = i >= la.length ? 0 : la[i];
    let rv = i >= ra.length ? 0 : ra[i];
    if (lv === rv) continue;

    lv = lv in LABEL_WEIGHTS ? LABEL_WEIGHTS[lv] : val(lv);
    rv = rv in LABEL_WEIGHTS ? LABEL_WEIGHTS[rv] : val(rv);

    if (lv === 0 && rv === 0) return lv > rv ? 1 : lv < rv ? -1 : 0;
    return lv > rv ? 1 : lv < rv ? -1 : 0;
  }
}

function compareVersionGte(left, right) { return compareVersion(left, right) >= 0; }
function compareVersionLt(left, right)  { return compareVersion(left, right) < 0; }

// MC version name to comparable triplet — PCL nameToVersion pattern
const FOOL_MAP = {
  '2.0':          '1.5.1',
  '15w14a':       '1.8.3',
  '24w14potato':  '1.20.4',
  '25w14craftmine': '1.21.4',
  '26w14a':       '26.1.1',
};

function nameToVersion(name) {
  const lower = name.toLowerCase().replace(/_unobfuscated$/, '');

  if (lower.includes('.rv-pre')) return { major: 1, minor: 9, build: 2, valid: true };
  if (lower.includes('shareware')) return { major: 1, minor: 13, build: 2, valid: true };

  for (const [fool, base] of Object.entries(FOOL_MAP)) {
    if (lower.startsWith(fool) || lower.includes(fool)) return nameToVersion(base);
  }

  if (lower.startsWith('20w14') && lower !== '20w14a') return { major: 1, minor: 15, build: 2, valid: true };
  if (lower.includes('oneblockatatime') || lower === '22w13oneblockatatime')
    return { major: 1, minor: 18, build: 2, valid: true };
  if (lower.startsWith('23w13a') && !lower.startsWith('20w13a'))
    return { major: 1, minor: 19, build: 4, valid: true };

  const segs = lower.split(/[ _\-./]+/);
  if (lower.startsWith('1.')) {
    return { major: Number(segs[1]) || 0, minor: 0, build: Number(segs[2]) || 0, valid: true };
  }
  if (/^[2-9]\d\./.test(lower)) {
    return { major: Number(segs[0]), minor: Number(segs[1]) || 0, build: Number(segs[2]) || 0, valid: true };
  }
  return { major: 9999, minor: 0, build: 0, valid: false };
}

function versionToDrop(name) {
  const v = nameToVersion(name);
  if (v.major >= 1000) return 209;
  return v.major * 10 + v.minor;
}

// Forge/NeoForge version to comparable code
function forgelikeCode(ver) {
  if (!ver || ver === '未知版本') return 0;
  const segs = ver.match(/\d+/g)?.map(Number) || [];
  if (segs.length === 0) return 0;
  if (segs.length > 4) return segs[0] * 1000000 + segs[1] * 10000 + segs[3];
  if (segs.length === 3) return segs[0] * 1000000 + segs[1] * 10000 + segs[2];
  if (segs.length === 2) return segs[0] * 1000000 + segs[1] * 10000;
  return segs[0] * 1000000;
}

// OptiFine version to comparable code
function optifineCode(ver) {
  if (!ver || ver === '未知版本') return 0;
  const upper = ver.toUpperCase();
  let result = (upper.charCodeAt(0) - 65 + 1) * 100;
  result += Number(upper.substring(1).match(/\d+/)?.[0] || 0);
  result *= 100;
  const lower = ver.toLowerCase();
  if (lower.includes('pre')) {
    result += 50 + Number(lower.match(/(?<=pre)\d+/)?.[0] || 1);
  } else if (lower.includes('beta')) {
    result += Number(lower.match(/(?<=beta)\d+/)?.[0] || 1);
  } else {
    result += 99;
  }
  return result;
}

module.exports = {
  compareVersion,
  compareVersionGte,
  compareVersionLt,
  nameToVersion,
  versionToDrop,
  forgelikeCode,
  optifineCode,
};
