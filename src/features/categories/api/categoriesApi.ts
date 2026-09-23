import { http } from '#/lib/http'
import type {
  Category,
  CategoryWire,
  CreateCategoryWire,
  UpdateCategoryWire,
} from './types'
import { toCategory } from './types'

/**
 * Remote calls for the user-editable categories. The sync engine owns when these run; UI
 * code reads from the local DB, never from here directly.
 */
export const categoriesApi = {
  list: (): Promise<Category[]> =>
    http
      .get<CategoryWire[]>('/categories')
      .then((rows) => rows.map(toCategory)),

  create: (payload: CreateCategoryWire): Promise<Category> =>
    http.post<CategoryWire>('/categories', payload).then(toCategory),

  update: (id: string, payload: UpdateCategoryWire): Promise<Category> =>
    http.patch<CategoryWire>(`/categories/${id}`, payload).then(toCategory),

  remove: (id: string): Promise<void> =>
    http.del<void>(`/categories/${id}`).then(() => undefined),
}
