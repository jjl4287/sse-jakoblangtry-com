export interface BaseRepository<T, K = string> {
  findById(id: K): Promise<T | null>;
  findMany(options?: FindManyOptions<T>): Promise<T[]>;
  create(data: CreateInput<T>): Promise<T>;
  update(id: K, data: UpdateInput<T>): Promise<T>;
  delete(id: K): Promise<void>;
}

export interface FindManyOptions<T> {
  where?: Partial<T>;
  orderBy?: OrderByOptions<T>;
  take?: number;
  skip?: number;
  include?: string[];
}

export type CreateInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateInput<T> = Partial<CreateInput<T>>;
export type OrderByOptions<T> = Partial<Record<keyof T, 'asc' | 'desc'>>; 