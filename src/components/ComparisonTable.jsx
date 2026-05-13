export default function ComparisonTable({
  leftPhoneName,
  rightPhoneName,
  rows,
}) {
  return (
    <section className="comparison-section">
      <div className="comparison-heading">
        <p className="section-kicker">Quick Comparison</p>
        <h2>Specification Table</h2>
      </div>

      <div className="table-wrapper">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>{leftPhoneName}</th>
              <th>{rightPhoneName}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.feature}>
                <td>{row.feature}</td>
                <td>{row.leftValue}</td>
                <td>{row.rightValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
