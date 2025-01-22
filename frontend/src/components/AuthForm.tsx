import React, { useState } from 'react';
import { Link } from 'react-router-dom';
interface AuthFormProps<T> {
  title: string;
  fields: { 
    name: keyof T;
    type: string;
    placeholder: string,
    required: boolean,
  }[];
  onSubmit: (formData: T) => void;
  error?: string | null;
  submitButtonText: string;
  linkText?: string;
  linkTo?: string;
  onSuccess?: () => void;
}

const AuthForm = <T extends { [key: string]: string }>({
  title,
  fields,
  onSubmit,
  error,
  submitButtonText,
  linkText,
  linkTo,
  onSuccess,
}: AuthFormProps<T>) => {
  const [formData, setFormData] = useState<T>({} as T);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    if(onSuccess){
      onSuccess();
    }
  };

  return (
    <div className="hero h-auto bg-transparent">
      <div className="hero-content flex-col">
        <div className="text-center">
          <h1 className="text-5xl font-bold">{title}</h1>
          <p className="py-6">{title}</p>
        </div>
        <div className="card sm:w-[30rem] shadow-2xl bg-base-100">
          <form className="card-body" onSubmit={handleSubmit}>
            {error && <div className="alert alert-error">{error}</div>}
            {fields.map((field) => (
              <div className="form-control" key={field.name as string}>
                <label className="label">
                  <span className="label-text">{String(field.name)}</span>
                </label>
                <input
                  type={field.type}
                  name={field.name as string}
                  placeholder={field.placeholder}
                  className="input input-bordered"
                  value={formData[field.name] || ''}
                  onChange={handleChange}
                  required={field.required}
                />
              </div>
            ))}
            <div className="form-control mt-6">
              <button className="btn btn-primary" type="submit">
                {submitButtonText}
              </button>
            </div>
            <p>
             <Link className="text-sky-600" to={linkTo as string}>{linkText}</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;