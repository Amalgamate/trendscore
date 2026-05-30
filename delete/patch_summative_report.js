/**
 * patch_summative_report.js  —  OBSOLETE — DO NOT RUN
 * All fixes permanently applied. Kept for historical reference only.
 * Run once from the project root:  node patch_summative_report.js
 * Applies two PDF fixes to SummativeReport.jsx:
 *   Fix 1 — Recharts ResponsiveContainer replaced with static SVG
 *   Fix 2 — useState/useEffect comment fetch removed from LearnerReportTemplate
 *   Fix 3 — commentData added to LearnerReportTemplate props
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  'src', 'components', 'CBCGrading', 'pages', 'SummativeReport.jsx'
);

let src = fs.readFileSync(filePath, 'utf8');

// ─────────────────────────────────────────────────────────────
// FIX 1  Replace Recharts chart with static SVG
// ─────────────────────────────────────────────────────────────
const RECHARTS_BLOCK = `        {/* LEFT: Bar Chart — half width, left-aligned */}
        <div>
          <h3 style={{ fontSize: '10px', fontWeight: '800', color: '#111827', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', marginBottom: '6px', paddingBottom: '2px' }}>Subject Performance</h3>
          <div style={{ height: '80px', width: '100%' }}>
            {tableRows && tableRows.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tableRows.map(r => ({ ...r, area: getAbbreviatedName(r.area) }))} margin={{ top: 5, right: 5, left: -25, bottom: 0 }} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="area" interval={0} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} tick={{ fontSize: 6, fontWeight: 'bold', fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 6, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Bar dataKey="percentage">
                    {tableRows.map((entry, index) => (
                      <Cell key={\`cell-\${index}\`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>

                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#f8fafc', fontSize: '10px', color: '#9ca3af', fontWeight: 'bold', textTransform: 'uppercase' }}>No data</div>
            )}
          </div>
        </div>`;

const STATIC_SVG_BLOCK = `        {/* LEFT: Bar Chart — static SVG (PDF-safe, no Recharts/ResponsiveContainer) */}
        <div>
          <h3 style={{ fontSize: '10px', fontWeight: '800', color: '#111827', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', marginBottom: '6px', paddingBottom: '2px' }}>Subject Performance</h3>
          {tableRows && tableRows.length > 0 ? (() => {
            const svgW = 260;
            const chartH = 80;
            const labelH = 14;
            const leftPad = 24;
            const rightPad = 4;
            const barAreaW = svgW - leftPad - rightPad;
            const barW = Math.max(6, Math.floor(barAreaW / tableRows.length) - 4);
            const gap = tableRows.length > 1
              ? Math.floor((barAreaW - barW * tableRows.length) / (tableRows.length - 1))
              : 0;
            return (
              <svg
                width={svgW}
                height={chartH + labelH + 2}
                style={{ display: 'block', overflow: 'visible' }}
                xmlns="http://www.w3.org/2000/svg"
              >
                {[25, 50, 75, 100].map(v => {
                  const y = chartH - Math.round((v / 100) * chartH);
                  return (
                    <g key={v}>
                      <line x1={leftPad} y1={y} x2={svgW - rightPad} y2={y} stroke="#f1f5f9" strokeWidth="0.5" />
                      <text x={leftPad - 3} y={y + 3} textAnchor="end" fontSize="6" fill="#94a3b8" fontFamily="Arial, sans-serif">{v}</text>
                    </g>
                  );
                })}
                <line x1={leftPad} y1={chartH} x2={svgW - rightPad} y2={chartH} stroke="#e2e8f0" strokeWidth="0.5" />
                {tableRows.map((row, i) => {
                  const barH = Math.max(2, Math.round((row.percentage / 100) * chartH));
                  const x = leftPad + i * (barW + gap);
                  const y = chartH - barH;
                  const fill = CHART_COLORS[i % CHART_COLORS.length];
                  const abbr = getAbbreviatedName(row.area).slice(0, 5);
                  return (
                    <g key={row.area}>
                      <rect x={x} y={y} width={barW} height={barH} fill={fill} rx="2" />
                      {barH > 14 && (
                        <text x={x + barW / 2} y={y - 2} textAnchor="middle" fontSize="6" fontWeight="bold" fill={fill} fontFamily="Arial, sans-serif">
                          {row.percentage}%
                        </text>
                      )}
                      <text x={x + barW / 2} y={chartH + 11} textAnchor="middle" fontSize="6" fontWeight="bold" fill="#64748b" fontFamily="Arial, sans-serif">
                        {abbr}
                      </text>
                    </g>
                  );
                })}
              </svg>
            );
          })() : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', background: '#f8fafc', fontSize: '10px', color: '#9ca3af', fontWeight: 'bold', textTransform: 'uppercase' }}>No data</div>
          )}
        </div>`;

// ─────────────────────────────────────────────────────────────
// FIX 2  Remove useState/useEffect comment fetch from template
// ─────────────────────────────────────────────────────────────
const COMMENT_STATE_BLOCK = `  // --- COMMENT STATE & LOGIC ---
  const [commentData, setCommentData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedComment, setEditedComment] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Debounced auto-save useEffect
  useEffect(() => {
    if (!isEditing || !isTyping) return;

    const timer = setTimeout(() => {
      handleSaveComment();
      setIsTyping(false);
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [editedComment]);

  useEffect(() => {
    const fetchComment = async () => {
      if (!learner?.id) return;
      try {
        const res = await api.cbc.getComments(learner.id, { term, academicYear });
        if (res.success && res.data) {
          setCommentData(res.data);
          setEditedComment(res.data.classTeacherComment || '');
        }
      } catch (err) {
        console.error('Error fetching comments:', err);
      }
    };
    fetchComment();
  }, [learner?.id, term, academicYear]);

  const handleSaveComment = async () => {
    if (!learner?.id) return;
    try {
      setIsSavingComment(true);
      const payload = {
        learnerId: learner.id,
        term,
        academicYear,
        classTeacherComment: editedComment,
        classTeacherName: user?.firstName ? \`\${user.firstName} \${user.lastName}\` : 'Class Teacher',
        classTeacherDate: new Date().toISOString(),
        nextTermOpens: commentData?.nextTermOpens || new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString()
      };

      const res = await api.cbc.saveComments(payload);
      if (res.success) {
        setCommentData(res.data);
      }
    } catch (err) {
      console.error('Error saving comment:', err);
    } finally {
      setIsSavingComment(false);
    }
  };`;

const COMMENT_PROP_REPLACEMENT = `  // --- COMMENT: received as prop (pre-fetched by parent before bulk print).
  // commentData is passed in directly — no per-card API call during bulk PDF generation.
  // The parent (SummativeReport) is responsible for fetching all comments before
  // rendering LearnerReportTemplate instances for print.`;

// ─────────────────────────────────────────────────────────────
// FIX 3  Add commentData to LearnerReportTemplate prop signature
// ─────────────────────────────────────────────────────────────
const OLD_SIGNATURE = `const LearnerReportTemplate = ({ learner, results, pathwayPrediction, term, academicYear, brandingSettings, user, streamConfigs, remarks }) => {`;
const NEW_SIGNATURE = `const LearnerReportTemplate = ({ learner, results, pathwayPrediction, term, academicYear, brandingSettings, user, streamConfigs, remarks, commentData }) => {`;

// ── Apply ──────────────────────────────────────────────────────

let changed = false;

if (src.includes(RECHARTS_BLOCK)) {
  src = src.replace(RECHARTS_BLOCK, STATIC_SVG_BLOCK);
  console.log('✅ Fix 1 applied: Recharts replaced with static SVG bar chart');
  changed = true;
} else {
  console.warn('⚠️  Fix 1 SKIPPED: Recharts block not found (already patched?)');
}

if (src.includes(COMMENT_STATE_BLOCK)) {
  src = src.replace(COMMENT_STATE_BLOCK, COMMENT_PROP_REPLACEMENT);
  console.log('✅ Fix 2 applied: useState/useEffect comment fetch removed from template');
  changed = true;
} else {
  console.warn('⚠️  Fix 2 SKIPPED: Comment state block not found (already patched?)');
}

if (src.includes(OLD_SIGNATURE)) {
  src = src.replace(OLD_SIGNATURE, NEW_SIGNATURE);
  console.log('✅ Fix 3 applied: commentData added to LearnerReportTemplate props');
  changed = true;
} else {
  console.warn('⚠️  Fix 3 SKIPPED: Signature not found (already patched?)');
}

if (changed) {
  fs.writeFileSync(filePath, src, 'utf8');
  console.log('\n✅ SummativeReport.jsx saved successfully.');
} else {
  console.log('\nℹ️  No changes written — file may already be patched.');
}
