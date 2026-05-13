const phoneFields = [
  { label: "Brand", key: "brand" },
  { label: "Release Date", key: "releaseDate" },
  {
    label: "Display",
    render: (phone) => [phone.displaySize, phone.displayType].filter(Boolean).join(" | "),
  },
  { label: "Processor", key: "processor" },
  { label: "RAM", key: "ram" },
  { label: "Storage", key: "storage" },
  { label: "Rear Camera", key: "rearCamera" },
  { label: "Front Camera", key: "frontCamera" },
  { label: "Battery", key: "battery" },
  { label: "Charging", key: "charging" },
  { label: "Operating System", key: "operatingSystem" },
  { label: "Network", key: "network" },
];

export default function PhoneCard({ title, phone }) {
  return (
    <article className="phone-card">
      <div className="phone-card-header">
        <div>
          <p className="phone-side-label">{title}</p>
          <h2>{phone?.name || "Search a mobile to see details"}</h2>
        </div>
      </div>

      <div className="phone-image-wrapper">
        {phone?.image ? (
          <img src={phone.image} alt={phone.name} className="phone-image" />
        ) : (
          <div className="phone-image-placeholder">
            Mobile image will appear here
          </div>
        )}
      </div>

      <div className="spec-list">
        {phoneFields.map((field) => {
          const value = field.render
            ? field.render(phone || {})
            : phone?.[field.key];

          return (
            <div className="spec-item" key={field.label}>
              <span className="spec-label">{field.label}</span>
              <span className="spec-value">{value || "Not available"}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
