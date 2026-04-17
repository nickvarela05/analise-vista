
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('gestor', 'analista');

CREATE TYPE public.demanda_origem    AS ENUM ('email', 'reuniao', 'chamado', 'whatsapp', 'outro');
CREATE TYPE public.demanda_categoria AS ENUM ('bug', 'melhoria', 'nova_funcionalidade', 'duvida', 'documentacao', 'outro');
CREATE TYPE public.demanda_status    AS ENUM ('aberta', 'em_analise', 'em_andamento', 'aguardando_cliente', 'homologacao', 'concluida', 'cancelada');
CREATE TYPE public.demanda_prioridade AS ENUM ('baixa', 'media', 'alta', 'critica');

CREATE TYPE public.todo_status     AS ENUM ('pendente', 'em_andamento', 'concluida', 'cancelada');
CREATE TYPE public.todo_prioridade AS ENUM ('baixa', 'media', 'alta');

CREATE TYPE public.reuniao_tipo   AS ENUM ('interna', 'cliente', 'fornecedor', 'alinhamento', 'outro');
CREATE TYPE public.reuniao_status AS ENUM ('agendada', 'realizada', 'cancelada');

CREATE TYPE public.aviso_tipo AS ENUM ('informativo', 'alerta', 'critico');

-- =========================================
-- updated_at trigger function
-- =========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================
-- PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  cargo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- USER ROLES
-- =========================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- =========================================
-- Auto-create profile + first user becomes gestor
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email
  );

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;

  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'gestor');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'analista');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- DEMANDA
-- =========================================
CREATE TABLE public.demanda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  origem public.demanda_origem NOT NULL DEFAULT 'outro',
  categoria public.demanda_categoria NOT NULL DEFAULT 'outro',
  status public.demanda_status NOT NULL DEFAULT 'aberta',
  prioridade public.demanda_prioridade NOT NULL DEFAULT 'media',
  solicitante TEXT,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  prazo DATE,
  tags TEXT[],
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.demanda ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_demanda_status ON public.demanda(status);
CREATE INDEX idx_demanda_responsavel ON public.demanda(responsavel_id);
CREATE INDEX idx_demanda_categoria ON public.demanda(categoria);

CREATE TRIGGER trg_demanda_updated_at
BEFORE UPDATE ON public.demanda
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- TODO (tarefas)
-- =========================================
CREATE TABLE public.todo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  status public.todo_status NOT NULL DEFAULT 'pendente',
  prioridade public.todo_prioridade NOT NULL DEFAULT 'media',
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_prevista DATE,
  concluida_em TIMESTAMPTZ,
  demanda_id UUID REFERENCES public.demanda(id) ON DELETE SET NULL,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.todo ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_todo_responsavel ON public.todo(responsavel_id);
CREATE INDEX idx_todo_status ON public.todo(status);
CREATE INDEX idx_todo_data ON public.todo(data_prevista);

CREATE TRIGGER trg_todo_updated_at
BEFORE UPDATE ON public.todo
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- REUNIAO
-- =========================================
CREATE TABLE public.reuniao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  tipo public.reuniao_tipo NOT NULL DEFAULT 'interna',
  status public.reuniao_status NOT NULL DEFAULT 'agendada',
  data_reuniao TIMESTAMPTZ NOT NULL,
  duracao_min INT,
  participantes TEXT[],
  link_calendario TEXT,
  pauta TEXT,
  resumo TEXT,
  transcricao TEXT,
  proximos_passos TEXT,
  audio_path TEXT,
  audio_size BIGINT,
  audio_mime TEXT,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reuniao ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_reuniao_data ON public.reuniao(data_reuniao);
CREATE INDEX idx_reuniao_responsavel ON public.reuniao(responsavel_id);

CREATE TRIGGER trg_reuniao_updated_at
BEFORE UPDATE ON public.reuniao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- AVISO_GESTOR
-- =========================================
CREATE TABLE public.aviso_gestor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo public.aviso_tipo NOT NULL DEFAULT 'informativo',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  expira_em TIMESTAMPTZ,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.aviso_gestor ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_aviso_ativo ON public.aviso_gestor(ativo);

CREATE TRIGGER trg_aviso_updated_at
BEFORE UPDATE ON public.aviso_gestor
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- COLABORADOR (portfólio)
-- =========================================
CREATE TABLE public.colaborador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cargo TEXT,
  bio TEXT,
  foto_url TEXT,
  email TEXT,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.colaborador ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_colaborador_updated_at
BEFORE UPDATE ON public.colaborador
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- RLS POLICIES
-- =========================================

-- profiles: usuário vê todos (equipe interna), só edita o seu
CREATE POLICY "Profiles visíveis para autenticados"
ON public.profiles FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Usuário insere seu próprio profile"
ON public.profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza seu próprio profile"
ON public.profiles FOR UPDATE
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Gestor pode atualizar profiles"
ON public.profiles FOR UPDATE
TO authenticated USING (public.has_role(auth.uid(), 'gestor'));

-- user_roles
CREATE POLICY "Usuário vê suas roles"
ON public.user_roles FOR SELECT
TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Gestor gerencia roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- demanda: equipe vê tudo; gestor faz tudo; analista cria e edita as suas / as que é responsável
CREATE POLICY "Equipe vê demandas"
ON public.demanda FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Autenticado cria demanda"
ON public.demanda FOR INSERT
TO authenticated WITH CHECK (auth.uid() = criado_por OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Atualiza demanda própria ou gestor"
ON public.demanda FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'gestor')
  OR auth.uid() = criado_por
  OR auth.uid() = responsavel_id
);

CREATE POLICY "Gestor deleta demanda"
ON public.demanda FOR DELETE
TO authenticated USING (public.has_role(auth.uid(), 'gestor'));

-- todo
CREATE POLICY "Equipe vê tarefas"
ON public.todo FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Autenticado cria tarefa"
ON public.todo FOR INSERT
TO authenticated WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "Atualiza tarefa própria ou gestor"
ON public.todo FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'gestor')
  OR auth.uid() = criado_por
  OR auth.uid() = responsavel_id
);

CREATE POLICY "Deleta tarefa própria ou gestor"
ON public.todo FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'gestor') OR auth.uid() = criado_por);

-- reuniao
CREATE POLICY "Equipe vê reuniões"
ON public.reuniao FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Autenticado cria reunião"
ON public.reuniao FOR INSERT
TO authenticated WITH CHECK (auth.uid() = criado_por);

CREATE POLICY "Atualiza reunião própria ou gestor"
ON public.reuniao FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'gestor')
  OR auth.uid() = criado_por
  OR auth.uid() = responsavel_id
);

CREATE POLICY "Gestor deleta reunião"
ON public.reuniao FOR DELETE
TO authenticated USING (public.has_role(auth.uid(), 'gestor'));

-- aviso_gestor
CREATE POLICY "Equipe vê avisos"
ON public.aviso_gestor FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Gestor gerencia avisos"
ON public.aviso_gestor FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- colaborador
CREATE POLICY "Todos veem colaboradores"
ON public.colaborador FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Gestor gerencia colaboradores"
ON public.colaborador FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'gestor'));

-- =========================================
-- STORAGE BUCKETS
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('reuniao-audios', 'reuniao-audios', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('colaborador-fotos', 'colaborador-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies reuniao-audios (privado, autenticados)
CREATE POLICY "Autenticado lê áudios de reunião"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'reuniao-audios');

CREATE POLICY "Autenticado faz upload de áudio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reuniao-audios');

CREATE POLICY "Autenticado atualiza áudio próprio"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'reuniao-audios' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Gestor deleta áudios"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'reuniao-audios' AND public.has_role(auth.uid(), 'gestor'));

-- Policies colaborador-fotos (público leitura, gestor escreve)
CREATE POLICY "Fotos de colaborador são públicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'colaborador-fotos');

CREATE POLICY "Gestor faz upload de foto colaborador"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'colaborador-fotos' AND public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Gestor atualiza foto colaborador"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'colaborador-fotos' AND public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Gestor deleta foto colaborador"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'colaborador-fotos' AND public.has_role(auth.uid(), 'gestor'));
