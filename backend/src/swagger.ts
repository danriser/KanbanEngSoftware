import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Plataforma de Gestão Kanban API',
    version: '1.0.0',
    description: 'Documentação executiva do motor relacional e analítico do sistema Kanban.',
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  tags: [
    { name: 'Autenticação', description: 'Gestão de identidade e acesso' },
    { name: 'Quadros', description: 'Estruturas macro de gestão (Boards)' },
    { name: 'Raias', description: 'Subdivisão horizontal de fluxo (Swimlanes)' },
    { name: 'Cartões', description: 'Unidades de trabalho e movimentação tática' },
    { name: 'Métricas', description: 'Motor analítico de desempenho' }
  ],
  paths: {
    // ==========================================
    // 1. AUTENTICAÇÃO
    // ==========================================
    '/login': {
      post: {
        tags: ['Autenticação'],
        summary: 'Geração de Token JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', example: 'usuario@kanban.com' },
                  password: { type: 'string', example: 'senha123' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Autenticado com sucesso' },
          401: { description: 'Credenciais inválidas' }
        }
      }
    },

    // ==========================================
    // 2. QUADROS (BOARDS)
    // ==========================================
    '/boards/{id}': {
      get: {
        tags: ['Quadros'],
        summary: 'Super Rota: Leitura Completa do Quadro',
        description: 'Retorna a estrutura completa de um quadro, incluindo suas raias, colunas ordenadas e cartões aninhados.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          200: { description: 'Estrutura do quadro carregada' },
          403: { description: 'Acesso negado (RBAC)' },
          404: { description: 'Quadro não localizado' }
        }
      }
    },

    // ==========================================
    // 3. RAIAS (SWIMLANES)
    // ==========================================
    '/swimlanes': {
      post: {
        tags: ['Raias'],
        summary: 'Criar Raia',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', example: 'Backend' },
                  boardId: { type: 'string', format: 'uuid' },
                  order: { type: 'integer', example: 0 }
                }
              }
            }
          }
        },
        responses: {
          201: { description: 'Raia criada com sucesso' },
          400: { description: 'Erro de validação (Zod)' },
          403: { description: 'Acesso negado' }
        }
      }
    },

    // ==========================================
    // 4. CARTÕES E MOVIMENTAÇÃO
    // ==========================================
    '/cards/{id}/move': {
      patch: {
        tags: ['Cartões'],
        summary: 'Reposicionamento Bidimensional (Transação ACID)',
        description: 'Move o cartão entre colunas e raias, respeitando o WIP Limit e gerando log de auditoria automático.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  columnId: { type: 'string', format: 'uuid', description: 'ID da coluna de destino' },
                  swimlaneId: { type: 'string', format: 'uuid', nullable: true, description: 'ID da raia de destino (opcional)' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Cartão movido e log registrado' },
          400: { description: 'WIP Limit excedido ou erro estrutural' },
          403: { description: 'Acesso negado' }
        }
      }
    },

    // ==========================================
    // 5. MOTOR ANALÍTICO
    // ==========================================
    '/boards/{id}/metrics': {
      get: {
        tags: ['Métricas'],
        summary: 'Cálculo de Indicadores Ágeis',
        description: 'Processa os logs de movimentação em memória e retorna Throughput, Cycle Time e Lead Time.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
        ],
        responses: {
          200: { 
            description: 'Dashboard numérico gerado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    metrics: {
                      type: 'object',
                      properties: {
                        throughput: { type: 'integer', example: 12 },
                        leadTimeDays: { type: 'number', example: 4.5 },
                        cycleTimeDays: { type: 'number', example: 1.2 }
                      }
                    }
                  }
                }
              }
            }
          },
          400: { description: 'O quadro não possui colunas suficientes para o cálculo' },
          403: { description: 'Acesso negado' }
        }
      }
    }
  }
};

export const setupSwagger = (app: Express): void => {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customSiteTitle: "Kanban API - Docs Executiva",
  }));
};