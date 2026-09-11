import { Controller } from 'react-hook-form'
import { Button } from '#/components/Button'
import { Checkbox } from '#/components/Checkbox'
import { PasswordField } from '#/components/PasswordField'
import { TextField } from '#/components/TextField'
import { useSignup } from '../hooks/useSignup'
import { passwordStrength } from '../passwordStrength'
import { FormError } from './FormError'
import { PasswordStrengthMeter } from './PasswordStrengthMeter'

export function SignupForm() {
  const { form, submit, formError } = useSignup()
  const {
    register,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = form

  const strength = passwordStrength(watch('password'))

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-[15px]">
      {formError ? <FormError message={formError} /> : null}

      <TextField
        label="Full name"
        id="signup-name"
        autoComplete="name"
        placeholder="Khalid Al-Rashid"
        error={errors.name?.message}
        {...register('name')}
      />

      <TextField
        label="Email address"
        id="signup-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register('email')}
      />

      <PasswordField
        label="Password"
        id="signup-password"
        autoComplete="new-password"
        placeholder="••••••••••"
        error={errors.password?.message}
        footer={<PasswordStrengthMeter strength={strength} />}
        {...register('password')}
      />

      <div>
        <Controller
          control={control}
          name="agree"
          render={({ field }) => (
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              onBlur={field.onBlur}
            >
              I agree to the{' '}
              <span className="font-semibold text-fp-accent-ink">Terms</span>{' '}
              and{' '}
              <span className="font-semibold text-fp-accent-ink">
                Privacy Policy
              </span>
              .
            </Checkbox>
          )}
        />
        {errors.agree?.message ? (
          <p className="mt-1.5 text-[12px] text-fp-danger">
            {errors.agree.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={isSubmitting} className="mt-0.5">
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  )
}
