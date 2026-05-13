import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from "typeorm";

/** Derived index table for faster filtering — extend columns as your rules evolve. */
@Entity({ name: "pad_categorized" })
@Unique("uq_pad_categorized_source_row_category", [
  "sourceTable",
  "sourceRowId",
  "category",
])
@Index("idx_pad_categorized_category", ["category"])
export class PadCategorized {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  sourceTable!: string;

  /** SQLite ROWID or your PK column value coerced to integer when possible. */
  @Column({ type: "integer" })
  sourceRowId!: number;

  @Column({ type: "text" })
  category!: string;

  @Column({ type: "text", nullable: true })
  subcategory!: string | null;

  /** Snapshot of columns you care about for debugging / audit (JSON text). */
  @Column({ type: "text", nullable: true })
  summaryJson!: string | null;

  @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
  indexedAt!: Date;
}
