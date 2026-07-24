import { redirect } from "next/navigation";
import { QuestionGarden } from "@/features/question-garden/question-garden";
import { authorizeQuestionGarden, loadQuestionGardenFoundation, recordQuestionGardenVisit } from "@/lib/question-garden/foundation";

export default async function QuestionGardenPage() {
  const authorized = await authorizeQuestionGarden();
  if (!authorized) redirect("/?view=world");
  const foundation = await loadQuestionGardenFoundation(authorized);
  await recordQuestionGardenVisit(authorized);
  return <QuestionGarden foundation={foundation} gardenCompleted={Boolean(authorized.progress.question_garden_completed_at)} />;
}
