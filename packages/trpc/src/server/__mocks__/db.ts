import { vi } from "vitest";

export type MockQueryBuilder = {
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  offset: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  innerJoin: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

export function createMockDb(): MockQueryBuilder {
  const mockBuilder: MockQueryBuilder = {
    insert: vi.fn(),
    values: vi.fn(),
    returning: vi.fn(),
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    offset: vi.fn(),
    leftJoin: vi.fn(),
    innerJoin: vi.fn(),
    groupBy: vi.fn(),
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };

  // Chain all methods to return the builder
  Object.keys(mockBuilder).forEach((key) => {
    const method = key as keyof MockQueryBuilder;
    mockBuilder[method].mockReturnValue(mockBuilder);
  });

  // Default returning to resolve to empty array
  mockBuilder.returning.mockResolvedValue([]);

  return mockBuilder;
}

// Helper to set up mock return values for specific queries
export function mockDbQuery(
  db: MockQueryBuilder,
  result: unknown[],
): MockQueryBuilder {
  // Make the chain resolve to the result
  db.returning.mockResolvedValue(result);
  db.select.mockImplementation(() => {
    const selectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(result),
          }),
          limit: vi.fn().mockResolvedValue(result),
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(result),
          }),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(result),
        }),
        limit: vi.fn().mockResolvedValue(result),
        leftJoin: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
      }),
    };
    return selectChain;
  });
  return db;
}
