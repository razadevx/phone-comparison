export default function SearchBox({
  label,
  placeholder,
  value,
  onChange,
}) {
  return (
    <label className="search-box">
      <span className="search-label">{label}</span>
      <input
        type="text"
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
