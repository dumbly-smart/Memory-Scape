import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db/pool';
import { jsonError } from '@/lib/api';
import { algorithmParametersSchema } from '@/lib/algorithm-parameters';

const columns = `valence_base AS "valenceBase", valence_salience AS "valenceSalience",
  review_strength_weight AS "reviewStrengthWeight", review_age_weight AS "reviewAgeWeight",
  review_age_cap_days AS "reviewAgeCapDays", updated_at AS "updatedAt"`;

export async function GET() {
  try {
    const result = await pool.query(`SELECT ${columns} FROM algorithm_parameters WHERE singleton`);
    return NextResponse.json({ data: result.rows[0] });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const value = algorithmParametersSchema.parse(await request.json());
    const result = await pool.query(
      `UPDATE algorithm_parameters SET valence_base=$1,valence_salience=$2,
       review_strength_weight=$3,review_age_weight=$4,review_age_cap_days=$5,updated_at=now()
       WHERE singleton RETURNING ${columns}`,
      [value.valenceBase,value.valenceSalience,value.reviewStrengthWeight,value.reviewAgeWeight,value.reviewAgeCapDays],
    );
    return NextResponse.json({ data: result.rows[0] });
  } catch (error) {
    return jsonError(error);
  }
}
