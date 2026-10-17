interface VerifyPageProps {
  params: Promise<{ code: string }>;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function VerifyPage({ params }: VerifyPageProps) {
  const { code } = await params;
  return (
    <div className="center-screen">
      <section className="hud denied">
        <h1>אימות תעודה</h1>
        <p className="muted">
          קוד: <span dir="ltr" className="ink">{safeDecode(code)}</span>
        </p>
      </section>
    </div>
  );
}
