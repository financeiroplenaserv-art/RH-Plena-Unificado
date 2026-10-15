/**
 * Aviso da prévia da importação de ponto (Adicionais → Importar Ponto).
 *
 * A importação só grava dias no calendário de quem tem VÍNCULO cobrindo a
 * data — quem não tem recebe só as ocorrências. Quando metade ou mais dos
 * colaboradores do espelho está sem vínculo cobrindo o período, quase sempre
 * a causa é a virada do período (dia 20) sem rodar o "Copiar período
 * anterior" na aba Vínculos — caso real de 14/10/2026: as importações de
 * 08/10 e 14/10 gravaram só 3 vínculos porque os 188 vínculos do período
 * foram criados DEPOIS da importação, e o calendário ficou vazio.
 *
 * O mínimo de 5 com ponto evita alarme falso em espelhos parciais/pequenos
 * (semana solta, arquivo de um contrato só).
 */
export function deveAvisarVinculosFaltando(totalComPonto: number, semVinculo: number): boolean {
  return totalComPonto >= 5 && semVinculo * 2 >= totalComPonto
}
