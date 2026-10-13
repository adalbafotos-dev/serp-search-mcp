export class AppError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 400) {
    super(message);
    this.name = "AppError";
  }
}

export function publicError(error: unknown) {
  if (error instanceof AppError) return { code: error.code, message: error.message, status: error.status };
  return { code: "INTERNAL_ERROR", message: "Não foi possível concluir a operação. Tente novamente.", status: 500 };
}
