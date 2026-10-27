/** A recuperação de uma sessão não pode depender de uma requisição sem prazo. */
export function createSessionRedirect(
  clear: (signal: AbortSignal) => Promise<unknown>,
  navigate: () => void,
  delay = 2000,
) {
  let started = false;
  return () => {
    if (started) return;
    started = true;
    const controller = new AbortController();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      controller.abort();
      navigate();
    };
    const timer = setTimeout(finish, delay);
    // Também protege contra implementações que lançam antes de devolver Promise.
    Promise.resolve().then(() => clear(controller.signal)).then(finish, finish);
  };
}
