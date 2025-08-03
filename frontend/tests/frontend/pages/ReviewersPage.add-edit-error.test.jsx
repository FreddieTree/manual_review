// tests/frontend/pages/ReviewersPage.add-edit-error.test.jsx
import React from "react";
import { render, screen, fireEvent, waitFor } from "../test-utils";
import { server } from "../msw/server";
import { http, HttpResponse } from 'msw';
import ReviewersPage from "../../../src/pages/ReviewersPage";

test("add, edit, cancel and server error", async () => {
    render(<ReviewersPage />);
    await screen.findByText("Alice");

    // Add 失败
    server.use(http.post('/api/reviewers', () =>
        HttpResponse.json({ message: 'email exists' }, { status: 422 })
    ))
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "New Guy" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "new@bristol.ac.uk" } });
    fireEvent.click(screen.getByRole("button", { name: /add reviewer/i }));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent(/email exists/i);

    // Edit 成功
    server.use(
        http.get('/api/reviewers', () =>
            HttpResponse.json(
                {
                    reviewers: [
                        { name: 'Bob', email: 'bob@bristol.ac.uk', role: 'admin', active: false },
                    ],
                    meta: { total: 1 },
                },
                { status: 200 }
            )
        ),

        http.put('/api/reviewers/bob%40bristol.ac.uk', () =>
            HttpResponse.json({ ok: true }, { status: 200 })
        ),
    );
    fireEvent.change(screen.getByLabelText(/search reviewers/i), { target: { value: "bob" } });
    await screen.findByText("Bob");
    fireEvent.click(screen.getByRole("button", { name: /edit bob@bristol\.ac\.uk/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "Bobby" } });
    fireEvent.click(screen.getByRole("button", { name: /update reviewer/i }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
});