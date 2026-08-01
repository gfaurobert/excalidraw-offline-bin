export interface StartScreenProps {
  recent: { path: string; label: string }[];
  status?: string;
  onNew: () => void;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: 280,
  padding: "0.55rem 0",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: "1rem",
  color: "#1e1e1e",
  fontFamily: "system-ui, sans-serif",
};

const shortcutStyle: React.CSSProperties = {
  color: "#868e96",
  fontSize: "0.95rem",
};

export function StartScreen(props: StartScreenProps) {
  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "0.25rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1.75rem",
          }}
        >
          <img
            src="/icon.png"
            alt=""
            width={40}
            height={40}
            style={{ borderRadius: 8 }}
          />
          <div style={{ fontSize: "1.35rem", color: "#1e1e1e" }}>
            <strong>Excalidraw</strong>{" "}
            <em style={{ fontStyle: "italic", fontWeight: 400 }}>offline</em>
          </div>
        </div>

        <button type="button" style={rowStyle} onClick={props.onNew}>
          <span>New file</span>
          <span style={shortcutStyle}>Ctrl+N</span>
        </button>
        <button type="button" style={rowStyle} onClick={props.onOpen}>
          <span>Open file</span>
          <span style={shortcutStyle}>Ctrl+O</span>
        </button>

        {props.status ? (
          <div
            style={{
              width: 280,
              marginTop: "0.5rem",
              fontSize: "0.85rem",
              color: /fail/i.test(props.status) ? "#c92a2a" : "#868e96",
              lineHeight: 1.35,
            }}
          >
            {props.status}
          </div>
        ) : null}

        <div
          style={{
            width: 280,
            height: 1,
            background: "#dee2e6",
            margin: "1rem 0 0.75rem",
          }}
        />

        <div
          style={{
            color: "#868e96",
            fontSize: "0.85rem",
            marginBottom: "0.35rem",
          }}
        >
          Recent files
        </div>

        {props.recent.length === 0 ? (
          <div style={{ color: "#adb5bd", fontSize: "0.95rem", padding: "0.35rem 0" }}>
            No recent files
          </div>
        ) : (
          props.recent.map((item) => (
            <button
              key={item.path}
              type="button"
              style={rowStyle}
              onClick={() => props.onOpenRecent(item.path)}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 240,
                  textAlign: "left",
                }}
              >
                {item.label}
              </span>
              <span style={shortcutStyle}>{">"}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
