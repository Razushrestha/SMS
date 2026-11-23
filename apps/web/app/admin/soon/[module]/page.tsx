import { PageChrome } from "@/components/page-chrome";

export default async function SoonPage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const title = module.replace(/-/g, " ");
  return (
    <PageChrome icon="fa-light fa-clock" crumbs={[{ label: "Modules" }, { label: title }]}>
      <div className="esk-empty">
        <div><i className="fa-light fa-clock" /></div>
        <h5 className="capitalize">{title}</h5>
        <p>This module is on the product map and is not built yet. Institute profile, sign-in, and the admin shell are the working pieces.</p>
      </div>
    </PageChrome>
  );
}
