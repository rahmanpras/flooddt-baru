"""Summarise experiments/results/runs.csv into the tables used in the manuscript.

    env/Scripts/python.exe experiments/analyze_results.py

Writes experiments/results/summary.md and summary_tables.json.
"""
import json
import os

import numpy as np
import pandas as pd
from scipy.stats import wilcoxon

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(HERE, 'results')
runs = pd.read_csv(os.path.join(RES, 'runs.csv'))
design = json.load(open(os.path.join(RES, 'design.json')))
checks = json.load(open(os.path.join(RES, 'checks.json')))
EV = design['cfg']['evalDepth']
SENS = design['cfg']['sensitivityEvalDepths']
MLAB = {'M1_distance': 'Distance-based Dijkstra', 'M2_proposed': 'Proposed flood-aware',
        'M3_an2025': 'Adapted An et al. [18]'}
SCN = ['S0', 'S1', 'S2', 'S3', 'S4', 'S2b', 'S4b']
out = {}
md = []

def to_md(df, index=False):
    """Plain markdown table (avoids the optional 'tabulate' dependency)."""
    if index:
        df = df.reset_index()
    cols = [str(c) for c in df.columns]
    lines = ['| ' + ' | '.join(cols) + ' |', '|' + '|'.join('---' for _ in cols) + '|']
    for _, r in df.iterrows():
        lines.append('| ' + ' | '.join('' if pd.isna(v) else str(v) for v in r.values) + ' |')
    return '\n'.join(lines)



def miqr(x, fmt='{:.2f}'):
    x = pd.Series(x).dropna()
    if len(x) == 0:
        return '–'
    q1, q2, q3 = np.percentile(x, [25, 50, 75])
    return f"{fmt.format(q2)} [{fmt.format(q1)}–{fmt.format(q3)}]"


# ── Table A: main results per scenario × method ──
rows = []
for s in SCN:
    for m in MLAB:
        d = runs[(runs.scenario == s) & (runs.method == m)]
        ret = d[d.returned]
        n = len(d)
        trav = int(d[f'traversable_{EV}'].sum())
        rows.append({
            'Scenario': s, 'Method': MLAB[m], 'n': n,
            'Route length (km)': miqr(ret.length_km),
            'Cumulative exposure E (m²)': miqr(ret.exposure_m2, '{:.1f}'),
            'Max depth (m)': miqr(ret.max_depth_m),
            'Inundated length (m)': miqr(ret.wet_length_m, '{:.0f}'),
            'Route returned': int(d.returned.sum()),
            'No route (diagnostic)': int((~d.returned).sum()),
            f'Reaches shelter under evaluation rule (d ≤ {EV} m)': f"{trav}/{n} ({100 * trav / n:.0f}%)",
            'Reference reachable': int(d[f'ref_reachable_{EV}'].sum()),
            'Query time (ms)': miqr(d.query_ms_median, '{:.1f}'),
            'E mean': round(ret.exposure_m2.mean(), 1) if len(ret) else None,
        })
tabA = pd.DataFrame(rows)
out['tableA'] = rows
md.append('## Table A. Results per scenario and method (median [IQR] over returned routes; counts over all 40 origins)\n')
md.append(to_md(tabA))

# ── Table B: paired differences vs the proposed method ──
prow = []
for s in SCN:
    p = runs[runs.scenario == s].pivot(index='origin', columns='method')
    for base in ['M1_distance', 'M3_an2025']:
        both = p['returned']['M2_proposed'].astype(bool) & p['returned'][base].astype(bool)
        L2, Lb = p['length_km']['M2_proposed'][both], p['length_km'][base][both]
        E2, Eb = p['exposure_m2']['M2_proposed'][both], p['exposure_m2'][base][both]
        dL, dE = (L2 - Lb), (E2 - Eb)
        rel = 100 * dL / Lb

        def wp(x):
            x = x[np.abs(x) > 1e-9]
            return (f"{wilcoxon(x).pvalue:.2g}" if len(x) >= 6 else 'n/a'), len(x)
        pL, nL = wp(dL.values)
        pE, nE = wp(dE.values)
        prow.append({
            'Scenario': s, 'Comparison': f'Proposed − {MLAB[base]}', 'Paired n': int(both.sum()),
            'Δ length (km)': miqr(dL), 'Δ length (%)': miqr(rel, '{:.1f}'),
            'Δ exposure (m²)': miqr(dE, '{:.1f}'), 'Mean Δ exposure (m²)': round(dE.mean(), 1) if both.sum() else None,
            'Origins with lower E': int((dE < -1e-9).sum()), 'Origins with longer route': int((dL > 1e-9).sum()),
            'Wilcoxon p (length)': pL, 'non-zero pairs L': nL, 'Wilcoxon p (exposure)': pE, 'non-zero pairs E': nE,
            'Different shelter': int((p['shelter']['M2_proposed'][both] != p['shelter'][base][both]).sum()),
        })
tabB = pd.DataFrame(prow)
out['tableB'] = prow
md.append('\n\n## Table B. Paired differences (proposed minus comparator), origins where both returned a route\n')
md.append(to_md(tabB))

# ── Table C: outcome classes, isolation identification ──
crow = []
for s in SCN:
    for m in MLAB:
        d = runs[(runs.scenario == s) & (runs.method == m)]
        ref = d[f'ref_reachable_{EV}'].astype(bool)
        trav = d[f'traversable_{EV}'].astype(bool)
        ret = d.returned.astype(bool)
        crow.append({
            'Scenario': s, 'Method': MLAB[m],
            'Reachable origins: traversable route': f"{int((ref & trav).sum())}/{int(ref.sum())}",
            'Reachable origins: non-traversable route': int((ref & ret & ~trav).sum()),
            'Reachable origins: no route (over-blocking)': int((ref & ~ret).sum()),
            'Isolated origins: correctly reported no route': f"{int((~ref & ~ret).sum())}/{int((~ref).sum())}",
            'Isolated origins: route through blocked edges': int((~ref & ret).sum()),
            'Correct classification': f"{int(((ref & trav) | (~ref & ~ret)).sum())}/{len(d)}",
        })
out['tableC'] = crow
md.append(f'\n\n## Table C. Outcome classes against reference reachability (common rule d ≤ {EV} m)\n')
md.append(to_md(pd.DataFrame(crow)))

# ── Table D: sensitivity of reachability to the evaluation threshold ──
srow = []
for s in SCN:
    for m in MLAB:
        d = runs[(runs.scenario == s) & (runs.method == m)]
        r = {'Scenario': s, 'Method': MLAB[m]}
        for t in [SENS[0], EV, SENS[1]]:
            r[f'traversable @ {t} m'] = f"{int(d[f'traversable_{t}'].sum())}/{int(d[f'ref_reachable_{t}'].sum())}"
            r[f'over-blocked @ {t} m'] = int((d[f'ref_reachable_{t}'].astype(bool) & ~d.returned.astype(bool)).sum())
        srow.append(r)
out['tableD'] = srow
md.append('\n\n## Table D. Traversable routes / reference-reachable origins under alternative evaluation thresholds\n')
md.append(to_md(pd.DataFrame(srow)))

# ── Shelter selection ──
sel = runs[runs.returned].groupby(['scenario', 'method', 'shelter']).size().unstack(fill_value=0)
out['shelterSelection'] = sel.reset_index().to_dict(orient='records')
md.append('\n\n## Shelter selection counts (returned routes)\n')
md.append(to_md(sel, index=True))
s0 = runs[runs.scenario == 'S0'].pivot(index='origin', columns='method', values='shelter')
re_ = []
for s in SCN[1:]:
    p = runs[runs.scenario == s].pivot(index='origin', columns='method', values='shelter')
    re_.append({'Scenario': s, **{MLAB[m]: int(((p[m] != s0[m]) & p[m].notna()).sum()) for m in MLAB}})
out['reassigned'] = re_
md.append('\n\n## Origins assigned to a different shelter than in S0\n')
md.append(to_md(pd.DataFrame(re_)))

# ── S0 equivalence ──
p0 = runs[runs.scenario == 'S0'].pivot(index='origin', columns='method', values='length_km')
out['S0_equivalence'] = {'max_abs_len_diff_M2_M1_km': float((p0.M2_proposed - p0.M1_distance).abs().max()),
                         'max_abs_len_diff_M3_M1_km': float((p0.M3_an2025 - p0.M1_distance).abs().max())}

# ── Verification and sampling checks ──
v = pd.DataFrame(checks['verify'])
sc = pd.DataFrame(checks['sampleCheck'])
out['verify'] = {'n': len(v), 'equal': int(v.equal.sum()) if len(v) else 0,
                 'linear_ms_median': float(v.linear_ms.median()) if len(v) else None,
                 'linear_ms_iqr': [float(x) for x in np.percentile(v.linear_ms, [25, 75])] if len(v) else None,
                 'heap_ms_median': float(v.heap_ms.median()) if len(v) else None,
                 'heap_ms_iqr': [float(x) for x in np.percentile(v.heap_ms, [25, 75])] if len(v) else None}
costdiff = sc[(sc.cost_fixed.notna()) & (sc.cost_app3.notna())]
out['samplingCheck'] = {'routes': len(sc), 'same_found': int(sc.same_found.sum()), 'same_shelter': int(sc.same_shelter.sum()),
                        'cost_differs': int((np.abs(costdiff.cost_fixed - costdiff.cost_app3) > 1e-9).sum()),
                        'edges': checks['sampling']}
md.append('\n\n## Verification\n')
md.append('```\n' + json.dumps({k: out[k] for k in ['S0_equivalence', 'verify', 'samplingCheck']}, indent=1) + '\n```')

open(os.path.join(RES, 'summary.md'), 'w', encoding='utf-8').write('\n'.join(md))
json.dump(out, open(os.path.join(RES, 'summary_tables.json'), 'w'), indent=1, default=str)
print('\n'.join(md))
