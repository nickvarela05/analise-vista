
# Permitir que todos os usuários alterem o status das tarefas

## Problema confirmado

A regra de segurança do banco na tabela de tarefas só permite atualização por:
- Gestores (por isso funciona com Nickolas e Ewerton)
- Quem criou a tarefa
- Quem está atribuído como responsável
- Tarefas marcadas como "equipe toda"

Quando Felipe Pino ou Matheus arrastam uma tarefa que **não é deles**, o banco rejeita silenciosamente a mudança (sem erro visível). A interface atualiza na hora (atualização otimista), mas ao recarregar a página a tarefa volta ao status anterior.

## Solução

Atualizar a regra de acesso para que **qualquer usuário autenticado** possa atualizar tarefas (mover entre colunas do Kanban, mudar prioridade, etc.).

### Mudanças

1. **Migração no banco**: substituir a política de atualização da tabela de tarefas por uma que permite atualização a todos os usuários logados.
2. **Exclusão continua restrita**: apagar tarefas segue permitido apenas para gestores e criadores (sem mudança).
3. **Registro de histórico**: o registro de mudança de status (`todo_historico`) já funciona para todos — sem mudança necessária.

## Detalhes técnicos

```sql
DROP POLICY "Atualiza tarefa própria ou gestor" ON public.todo;
CREATE POLICY "Autenticado atualiza tarefas"
  ON public.todo FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

Nenhuma mudança de frontend é necessária — o código otimista já existe e passará a persistir corretamente.
