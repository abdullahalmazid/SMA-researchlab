/**
 * Drop-in replacement for the write half of "firebase/firestore" that also
 * records each write in the admin change log. Admin code imports from here
 * instead of "firebase/firestore"; everything else is re-exported unchanged.
 */
import * as firestore from "firebase/firestore";
import type { DocumentReference, WriteBatch } from "firebase/firestore";
import { logAdminAction, summariseData } from "./audit";

export * from "firebase/firestore";

export const setDoc = ((reference: DocumentReference, data: unknown, options?: firestore.SetOptions) =>
  (options
    ? firestore.setDoc(reference, data as firestore.DocumentData, options)
    : firestore.setDoc(reference, data as firestore.DocumentData)
  ).then((result) => {
    void logAdminAction(options ? "update" : "set", reference.path, summariseData(data));
    return result;
  })) as typeof firestore.setDoc;

export const updateDoc = ((reference: DocumentReference, ...rest: unknown[]) =>
  (firestore.updateDoc as (...args: unknown[]) => Promise<void>)(reference, ...rest).then((result) => {
    const data =
      typeof rest[0] === "string" || rest[0] instanceof firestore.FieldPath
        ? Object.fromEntries(
            rest.reduce<[string, unknown][]>((pairs, value, index) => {
              if (index % 2 === 0) pairs.push([String(value), rest[index + 1]]);
              return pairs;
            }, []),
          )
        : rest[0];
    void logAdminAction("update", reference.path, summariseData(data));
    return result;
  })) as typeof firestore.updateDoc;

export const addDoc = ((reference: firestore.CollectionReference, data: unknown) =>
  firestore.addDoc(reference, data as firestore.DocumentData).then((created) => {
    void logAdminAction("create", created.path, summariseData(data));
    return created;
  })) as typeof firestore.addDoc;

export const deleteDoc = ((reference: DocumentReference) =>
  firestore.deleteDoc(reference).then((result) => {
    void logAdminAction("delete", reference.path);
    return result;
  })) as typeof firestore.deleteDoc;

/** A batch that logs one entry per operation once it commits. */
export const writeBatch = ((database: firestore.Firestore) => {
  const batch = firestore.writeBatch(database);
  const ops: { op: "set" | "update" | "delete"; path: string; data?: unknown }[] = [];
  const wrapped: WriteBatch = {
    set: ((reference: DocumentReference, data: unknown, options?: firestore.SetOptions) => {
      ops.push({ op: options ? "update" : "set", path: reference.path, data });
      options ? batch.set(reference, data as firestore.DocumentData, options) : batch.set(reference, data as firestore.DocumentData);
      return wrapped;
    }) as WriteBatch["set"],
    update: ((reference: DocumentReference, ...rest: unknown[]) => {
      ops.push({ op: "update", path: reference.path, data: typeof rest[0] === "object" ? rest[0] : { [String(rest[0])]: rest[1] } });
      (batch.update as (...args: unknown[]) => WriteBatch)(reference, ...rest);
      return wrapped;
    }) as WriteBatch["update"],
    delete: ((reference: DocumentReference) => {
      ops.push({ op: "delete", path: reference.path });
      batch.delete(reference);
      return wrapped;
    }) as WriteBatch["delete"],
    commit: () =>
      batch.commit().then((result) => {
        ops.forEach(({ op, path, data }) => void logAdminAction(op, path, summariseData(data)));
        return result;
      }),
  } as WriteBatch;
  return wrapped;
}) as typeof firestore.writeBatch;
