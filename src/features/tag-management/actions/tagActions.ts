
'use server';

import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function addTagToAction(userIdInput: string, analysisIdInput: string, tag: string): Promise<void> {
  const userId = userIdInput?.trim() ?? '';
  const analysisId = analysisIdInput?.trim() ?? '';
  const trimmedTag = tag?.trim() ?? '';
  console.debug(`[addTagToAction] Effective userId: '${userId}', analysisId: '${analysisId}', tag: '${trimmedTag}' (Inputs: '${userIdInput}', '${analysisIdInput}', '${tag}')`);


  if (!userId || !analysisId || !trimmedTag) {
    const errorMsg = `[addTagToAction] CRITICAL: Invalid params. userId: '${userIdInput}', analysisId: '${analysisIdInput}', tag: '${tag}'.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  console.info(`[addTagToAction] Adding tag '${trimmedTag}' to ${analysisDocPath}. Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET'}`);
  const analysisRef = doc(db, analysisDocPath);
  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) throw new Error("Análise não encontrada.");
    const currentTags = analysisSnap.data().tags || [];
    if (!currentTags.includes(trimmedTag)) {
      await updateDoc(analysisRef, { tags: [...currentTags, trimmedTag] });
    }
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[addTagToAction] Error for ${analysisDocPath}:`, originalErrorMessage);
    throw new Error(originalErrorMessage);
  }
}

export async function removeTagAction(userIdInput: string, analysisIdInput: string, tagToRemove: string): Promise<void> {
  const userId = userIdInput?.trim() ?? '';
  const analysisId = analysisIdInput?.trim() ?? '';
  const trimmedTagToRemove = tagToRemove?.trim() ?? '';
  console.debug(`[removeTagAction] Effective userId: '${userId}', analysisId: '${analysisId}', tagToRemove: '${trimmedTagToRemove}' (Inputs: '${userIdInput}', '${analysisIdInput}', '${tagToRemove}')`);

  if (!userId || !analysisId || !trimmedTagToRemove) {
    const errorMsg = `[removeTagAction] CRITICAL: Invalid params. userId: '${userIdInput}', analysisId: '${analysisIdInput}', tag: '${tagToRemove}'.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  const analysisDocPath = `users/${userId}/analyses/${analysisId}`;
  console.info(`[removeTagAction] Removing tag '${trimmedTagToRemove}' from ${analysisDocPath}. Project: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'ENV_VAR_NOT_SET'}`);
  const analysisRef = doc(db, analysisDocPath);
  try {
    const analysisSnap = await getDoc(analysisRef);
    if (!analysisSnap.exists()) throw new Error("Análise não encontrada.");
    const currentTags = analysisSnap.data().tags || [];
    await updateDoc(analysisRef, { tags: currentTags.filter((t: string) => t !== trimmedTagToRemove) });
  } catch (error) {
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[removeTagAction] Error for ${analysisDocPath}:`, originalErrorMessage);
    throw new Error(originalErrorMessage);
  }
}


    