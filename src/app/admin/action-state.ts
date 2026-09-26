/**
 * Shared shapes for admin form actions.
 *
 * These live outside the `"use server"` modules on purpose: a server-action
 * file may only export async functions, so the constants and types that the
 * client forms need have to sit in a plain module.
 */

export type ActionState = {
  ok: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export const EMPTY_STATE: ActionState = { ok: false };

export type LoginState = { error?: string };

export const EMPTY_LOGIN_STATE: LoginState = {};
