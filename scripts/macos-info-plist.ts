/** Patch Deno Desktop's generated macOS Info.plist with .excalidraw types. */

export const MACOS_DRAWING_UTI = "dev.excalidraw.offline.drawing";

const DOCUMENT_TYPES_XML = `	<key>CFBundleDocumentTypes</key>
	<array>
		<dict>
			<key>CFBundleTypeExtensions</key>
			<array>
				<string>excalidraw</string>
			</array>
			<key>CFBundleTypeName</key>
			<string>Excalidraw drawing</string>
			<key>CFBundleTypeRole</key>
			<string>Editor</string>
			<key>LSHandlerRank</key>
			<string>Owner</string>
			<key>LSItemContentTypes</key>
			<array>
				<string>${MACOS_DRAWING_UTI}</string>
			</array>
		</dict>
	</array>
	<key>UTExportedTypeDeclarations</key>
	<array>
		<dict>
			<key>UTTypeConformsTo</key>
			<array>
				<string>public.json</string>
				<string>public.data</string>
			</array>
			<key>UTTypeDescription</key>
			<string>Excalidraw drawing</string>
			<key>UTTypeIdentifier</key>
			<string>${MACOS_DRAWING_UTI}</string>
			<key>UTTypeTagSpecification</key>
			<dict>
				<key>public.filename-extension</key>
				<array>
					<string>excalidraw</string>
				</array>
				<key>public.mime-type</key>
				<array>
					<string>application/vnd.excalidraw+json</string>
				</array>
			</dict>
		</dict>
	</array>
`;

function setPlistString(xml: string, key: string, value: string): string {
  const re = new RegExp(
    `(<key>${key}</key>\\s*<string>)([^<]*)(</string>)`,
  );
  if (re.test(xml)) return xml.replace(re, `$1${value}$3`);
  return xml.replace(
    /<\/dict>\s*<\/plist>\s*$/,
    `\t<key>${key}</key>\n\t<string>${value}</string>\n</dict>\n</plist>\n`,
  );
}

/**
 * Insert document types + UTI, and stamp CFBundle version keys.
 * Idempotent: if CFBundleDocumentTypes is already present, only versions update.
 */
export function patchMacosInfoPlist(xml: string, version: string): string {
  let out = xml;
  out = setPlistString(out, "CFBundleShortVersionString", version);
  out = setPlistString(out, "CFBundleVersion", version);
  if (out.includes("<key>CFBundleDocumentTypes</key>")) return out;
  const close = out.lastIndexOf("</dict>");
  if (close < 0) {
    throw new Error("Info.plist missing root </dict>");
  }
  return out.slice(0, close) + DOCUMENT_TYPES_XML + out.slice(close);
}
